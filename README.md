# cdk-s3-to-eventbridge

# REBASE MAIN BRANCH NOT MERGE

git pull origin main --rebase

## Public Endpoints

| Method | Endpoint | Description                |
| ------ | -------- | -------------------------- |
| POST   | /upload  | Main upload image endpoint |

## Running locally

Docker is required to run this service locally, as well as access to an instance of the `databse` POSTGRES database.

The Lambda need to connect to an instance of the `databse` database via Data API. As we cannot directly call Data API locally this requires the database connection to be "wrapped" via a Docker container and made to appear to the application as a Data API endpoint. It is recommended to use [local-data-api](https://github.com/koxudaxi/local-data-api) for this.

You can use the [docker-compose](./docker-compose.yml) file provided or execute a docker run as described below.

To use `local-data-api` run the below command...

`npm run docker:start`

... altering the values for `<POSTGRES_USERNAME>`, `<POSTGRES_PASSWORD>` and `<POSTGRES_HOST>` as appropriate.

If using a locally installed POSTGRES instance ensure you use this environment variable `POSTGRES_HOST=host.docker.internal`

Finally, you can run the service with:

`npm run dev`

> If you've never worked on this stack before and see a bunch of failed type
> errors, running the above command will also trigger the generation of these
> types.

## Technologies

- AWS CDK
- AWS API Gateway
- AWS Lambda
- Serverless POSTGRES
