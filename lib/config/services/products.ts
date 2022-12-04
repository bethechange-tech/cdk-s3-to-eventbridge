import { LambdaDefinition } from '/opt/types';

const environment = {};

const lambdaDefinitions: LambdaDefinition[] = [
  {
    name: 'create-products-lambda',
    environment,
    isPrivate: false,
    methods: ['POST'],
    endpoint: 'products',
  },
  {
    name: 'get-products-lambda',
    environment,
    isPrivate: false,
    methods: ['GET'],
    endpoint: 'products',
  },
  {
    name: 'get-product-lambda',
    environment,
    isPrivate: false,
    methods: ['GET'],
    endpoint: 'products/:slug',
  },
  {
    name: 'put-products-lambda',
    environment,
    isPrivate: false,
    methods: ['PUT'],
    endpoint: 'products/:id',
  },
  {
    name: 'put-delete-lambda',
    environment,
    isPrivate: false,
    methods: ['PUT'],
    endpoint: 'products/:id',
  },
  {
    name: 'popular-product-lambda',
    environment,
    isPrivate: false,
    methods: ['GET'],
    endpoint: 'popular-products',
  },
  {
    name: 'followed-shops-popular-products-lambda',
    environment,
    isPrivate: false,
    methods: ['GET'],
    endpoint: 'followed-shops-popular-products',
  },
];

export default lambdaDefinitions;
