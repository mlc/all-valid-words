import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import memoize from 'memoizee';

const ssm = new SecretsManagerClient({ region: 'us-east-1' });

export const getToken = memoize(
  () =>
    ssm
      .send(new GetSecretValueCommand({ SecretId: 'all-words/mastodon-api' }))
      .then(({ SecretString }) => {
        if (!SecretString) {
          throw new Error("couldn't get secret");
        }
        return SecretString;
      }),
  { promise: true }
);
