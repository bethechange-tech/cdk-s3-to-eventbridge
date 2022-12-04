export type CDKContext = {
  appName: string;
  region: string;
  environment: string;
  branchName: string;
  accountNumber: string;
  currentBranch: string;
};

export type LambdaDefinition = {
  name: string;
  memoryMB?: number;
  timeoutMins?: number;
  isPrivate: boolean;
  hasParams?: boolean;
  params?: string;
  endpoint?: string;
  methods?: string[];
  environment?: {
    [key: string]: string;
  };
};
