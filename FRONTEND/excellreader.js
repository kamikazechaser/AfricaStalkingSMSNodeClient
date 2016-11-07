console.log(sheet_name_list)
const cassandra = require('cassandra-driver');
const assert = require("assert")

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'sms_master'
};

var client = new cassandra.Client(connectionOptions);
const XLSX = require("xlsx")
var workbook = XLSX.readFile('members.xlsx');
var sheet_name_list = workbook.SheetNames;
const cassie = require("./query_creator")
const org_id = "37dfc5c0-9abc-11e6-a62e-0a6f3f26f5ce"

var batch = []
    // create a group for each
var groups = {}
var contacts = {}

sheet_name_list.map((sheet) => {
    const group = {
        id: timeId.now(),
        name: sheet,
        organisation: org_id
    }

    groups[sheet] = group
})




// go to each group and get the contacts of everyone
Object.keys(groups).map((group) => {
    // add the command to create a group
    batch.push(cassie.insertMaker({
        keyspace: "sms_master",
        table: "groups",
        record: groups[group]
    }))

    var contactDetails = XLSX.utils.sheet_to_json(workbook.Sheets[group], {
            raw: true
        })
        // create
    contactDetails.map((contactDetail) => {
        // add the command to create this user

        const contact = {
                id: timeId.now(),
                user_name: contactDetail["FIRST NAME"] + " " + contactDetail["SUR NAME"] + " " + contactDetail["OTHER NAMES"],
                phone_number: contactDetail["Contact"],
                organisation: org_id
            }
            // console.log(contactDetail["Contact"])
            // dont import a contact where we dont have the phone number yet
        if (contactDetail["Contact"] != undefined) {
            contacts[contactDetail["Contact"]] = contact

            // add the contact in the group we found him in
            const contact_group = {
                id: timeId.now(),
                contact: contact.id,
                contact_name: contact.user_name,
                group: groups[group].id,
                group_name: groups[group].name
            }

            batch.push(cassie.insertMaker({
                keyspace: "sms_master",
                table: "groups_per_contact",
                record: contact_group
            }))

        }

    })
})




// make the contacts queries
Object.keys(contacts).map((contact) => {
    batch.push(cassie.insertMaker({
        keyspace: "sms_master",
        table: "contacts",
        record: contacts[contact]
    }))
})

console.log(batch.length)

var p1 = batch.slice(0, 300);
var p2 = batch.slice(300, 600);
var p3 = batch.slice(600, 900);
var p4 = batch.slice(900, 1200);
client.batch(p1, (err, res) => {
    assert.ifError(err)
    console.log("data p1 dumped into cluster successfully")

    client.batch(p2, (err, res) => {
        assert.ifError(err)
        console.log("data p2 dumped into cluster successfully")

        client.batch(p3, (err, res) => {
            assert.ifError(err)
            console.log("data p3 dumped into cluster successfully")

            client.batch(p4, (err, res) => {
                assert.ifError(err)
                console.log("data p4 dumped into cluster successfully")
            })
        })
    })
})


// console.log(groups)
// console.log(contacts)
