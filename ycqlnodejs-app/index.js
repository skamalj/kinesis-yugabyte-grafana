const cassandra = require('cassandra-driver');
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

// Record for testing
const samplerecords = [{"id": "abc", "name": "kamal4"}];

// Client is declared globally so that it can be used in the processRecords function
var client;
var connection;

// This functions get the connection details from SSM Parameter Store.
// It is called only once when the Lambda function is started.
// It is not called again when the Lambda function is invoked.
// It returns a connection promise which is used in the processRecords function.
async function connectDB(){
    const ssmClient = new SSMClient();
    var command = new GetParameterCommand({ Name: "yugabyte.root-crt" });
    var ybRootCrt = ssmClient.send(command)

    command = new GetParameterCommand({ Name: "yugabyte.admin-user" });
    var ybAdminUser = ssmClient.send(command)

    command = new GetParameterCommand({ Name: "yugabyte.admin-password" });
    var ybAdminPassword = ssmClient.send(command)

    command = new GetParameterCommand({ Name: "yugabyte.host" });
    var ybHost= ssmClient.send(command)

    var conn_params = await Promise.all([ybRootCrt, ybAdminUser, ybAdminPassword, ybHost])
    .then(function(values) {
        const crt = values[0].Parameter.Value;
        const user = values[1].Parameter.Value;
        const password = values[2].Parameter.Value;
        const host= values[3].Parameter.Value;
        return [crt,user,password,host];
    });

    
    client = new cassandra.Client({
        contactPoints: [conn_params[3]],
        localDataCenter: 'eu-central-1',
        credentials: { username: conn_params[1], password: conn_params[2] },
        keyspace: 'kinesis',
        sslOptions: { ca: conn_params[0] }
    });

    //connect to Database
    return client.connect()
}

connection = connectDB();

// This function is called when the Lambda function is invoked.
// Function uses Promise.all to process the records in the batch and return a Promise.
// I could not make prepared statement option work with JSONB column, hence not used. 
async function processRecords(batch) {
    return connection
        .then(() => {
            console.log("Connected to Database");
            const query = "INSERT INTO transactions (id,details) VALUES (?,?)";
            return Promise.all(batch.map(v => {
                // prepare option is not working with jsonb column
                return client.execute(query,[JSON.parse(v).id, v])}));
        }).then(result => {
            return console.log("Records created " + JSON.stringify(result));
        }).catch((err) => {
            return console.log("Error when inserting data "+err.stack);
        });
}


exports.handler = async function(event, context) {
    var batch = event.Records.map(function(record) {
        return Buffer.from(record.kinesis.data, 'base64').toString('utf8');
    });
    return processRecords(batch);
};


