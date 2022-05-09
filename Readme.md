### Code in this repository is for building solution shown in picture below.

![Architecture](resources/Kinesis-Yugabyte-Grafana.jpg)

### Demo and code explanation is in this [blog](https://www.kamalsblog.com/2021/12/Retail-Store-analytics-Kinesis-lambda-yugabyte-grafana.html)

# Setup


## YB Database
Create your account on [yugabyte cloud](https://cloud.yugabyte.com/login). When creating the cluster make sure you choose AWS and same region where rest of components will be deployed (Kinesis, Parameter store, Lambda)

The scripts for SQL and CQL are in resources directory - ybschema.txt

## Parameter Store 
Lambda functions fetch database connection details from parameter store.  So the values which we copied from above can be sent to AWS parameter store using below commands,
```
aws ssm put-parameter --name "yugabyte.admin-user" --value "admin" --type String --tags "Key=app,Value=yugabyte"
```
* Use parameter name yugabyte.admin-password  for password
* yugabyte.host for host
* yugabyte.region for region (cloud region where you created database)
* yugabyte.root-crt for root certificate(commands below)

These are the parameter names used by lambda functions. If you decide to change the names, then change them in Lambda code as well.
 
To store root.crt, use  below commands to store (on Linux)
```
export SSL_ROOT=`echo "$(cat root.crt )"`
aws ssm put-parameter --name "yugabyte.root-crt" --value "$SSL_ROOT" --type String  --overwrite   --tier Advanced
```

## Kinesis Analytics
Create studio application and open it in zeppelin. I had used scaling configuration as Parallelism = 8 and Parallelism Per KPU = 2

The code is available in "resources/kinesis_analytics.txt". Copy this content to studio note.   
Make sure to update **aws.region** in the queries

## Deploy Lambda and Streams
Use below commands to deploy Lambda and Streams (from root directory)

```
sam build
sam deploy --guided (guided is only needed for first install)

To delete use below command
aws cloudformation delete-stack --stack-name sam-app --region <your region>
```

## Datagenartor
Data generator is used from [here](https://github.com/skamalj/datagenerator). The config required by this is in "resources/generator.config". Copy this file to generators "schema" directory as "config.yaml" and then execute below command:-

Kinesis configuration is explained in Readme for datagenerator sample.env file.

```
npm start -- -i 5
```

## Grafana
Before importing dashboard json (resources/grafana.json) make sure you create datasource named **PostgreSQL**