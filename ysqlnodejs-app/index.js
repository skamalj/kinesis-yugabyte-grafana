const { Pool, Client } = require('pg')
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

// Record for testing
const samplerecords = ['{"window_start": "", "window_end": "null", "store_id": 1, "product_name": "Rocket", "total_sales": 27.0}'];

var client;
var connection;

// This functions get the connection details from SSM Parameter Store.
// It is called only once when the Lambda function is started.
// It is not called again when the Lambda function is invoked.
// It returns a connection promise which is used in the processRecords function.
async function connectDB(){
    console.log("Connecting to Database");
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

    client = new Client({
        host: conn_params[3],
        user: conn_params[1], 
        password: conn_params[2],
        database: 'yugabyte',
        port: 5433,
        ssl: {
            rejectUnauthorized: true,
            ca: conn_params[0] 
        }
    });

    //connect to Database, return promise
    return client.connect();
}

connection = connectDB();

// postgres nodejs library has a bug that causes it to not return a promise, hence the async/await
function processRecords(batch) {
    return connection
        .then(async () => {
            console.log("Connected to Database");
            console.log("Processing Records");
            const query = "INSERT INTO summary VALUES ($1,$2,$3,$4,$5)";
            for (v of batch) {
                var v_json = JSON.parse(v);
                await client.query(query, [v_json.window_start,
                v_json.window_end, v_json.store_id, v_json.product_name,
                v_json.total_sale])
                console.log("Inserted record: " + v);
            }
        }).catch ((err) => {
            console.log("Error when inserting records:  " + err.stack);
        });
}

exports.handler = async function(event, context) {
    var batch = event.Records.map(function(record) {
        return Buffer.from(record.kinesis.data, 'base64').toString('utf8');
    });
    return processRecords(batch);
};


