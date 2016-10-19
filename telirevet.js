var telerivet = require('telerivet');

var API_KEY = 'KqeIRm77OCUW2IUB3ard8SNQe6rXcKHu'; // from https://telerivet.com/api/keys
var PROJECT_ID = 'PJf8acabf32a286127';

var tr = new telerivet.API(API_KEY);

var project = tr.initProjectById(PROJECT_ID);

// send message

project.sendMessage({
    to_number: '254711657108',
    content: 'Hello world!'
}, function(err, message) {
    if (err) throw err;
    console.log(message);
});

// import contact and add to group

// project.getOrCreateContact({
//     name: 'John Smith',
//     phone_number: '254711657108',
//     vars: {
//         birthdate: '1981-03-04',
//         network: 'Vodacom'
//     }
// }, function(err, contact) {
//     if (err) throw err;

//     project.getOrCreateGroup('Subscribers', function(err, group) {
//         if (err) throw err;

//         contact.addToGroup(group, function(err) {
//             if (err) throw err;
//         });
//     });
// });

// query contact information

// var namePrefix = 'John';
// var cursor = project.queryContacts({
//     name: { prefix: namePrefix },
//     sort: 'name'
// }).limit(20);

// cursor.count(function(err, count) {
//     if (err) throw err;

//     console.log(count + " contacts matching " + namePrefix + ":");

//     cursor.each(function(err, contact) {
//         if (err) throw err;

//         if (contact != null) {
//             console.log(contact.name + " " + contact.phone_number + " " + contact.vars.birthdate);
//         }
//     });
// });
