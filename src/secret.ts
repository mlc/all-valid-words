import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import memoize from 'memoizee';

const ssm = new SSMClient({ region: 'us-east-1' });

export const getToken: () => Promise<string> = memoize(
  () =>
    ssm
      .send(
        new GetParameterCommand({
          Name: '/all-words/mastodon-api',
          WithDecryption: true,
        })
      )
      .then(({ Parameter }) => {
        if (!Parameter?.Value) {
          throw new Error("couldn't get secret");
        }
        return Parameter.Value;
      }),
  { promise: true }
);
