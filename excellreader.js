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

var batch = []
    // create a group for each 
var groups = {}
var contacts = {}

sheet_name_list.map((sheet) => {
    const group = {
        id: timeId.now(),
        name: sheet
    }

    groups[sheet] = group
})

// batch.push(cassie.insertMaker({
//             keyspace: "sms_master",
//             table: "contacts",
//             record: contact
//         }))




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
            user_name: contactDetail["FIRST NAME"] + " " + contactDetail["SUR NAME"] + " " + contactDetail["OTHER NAMES"] + " " + ,
            phone_number: contactDetail["Contact"]
        }

        contactDetail["Contact"] contacts[contactDetail["Contact"]] = contact
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

client.batch(batch, (err, res) => {
    assert.ifError(err)
    console.log("data dumped into cluster successfully")
})


// console.log(groups)
// console.log(contacts)
