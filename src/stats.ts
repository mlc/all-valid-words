/* eslint-disable no-await-in-loop */
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { marshall } from '@aws-sdk/util-dynamodb';
import chunk from './chunk';
import { findBook, findPhrasings, GutenbergBook, metadata } from './post';

export const enqueuer: AWSLambda.Handler = async () => {
  const books = await metadata();
  const sqs = new SQSClient({ apiVersion: '2012-11-05', region: 'us-east-1' });
  const chunks = chunk(books, 50);
  for (let i = 0; i < chunks.length; i += 1) {
    const bigChunk = chunks[i];
    await Promise.all(
      chunk(bigChunk, 10).map((littleChunk) =>
        sqs.send(
          new SendMessageBatchCommand({
            Entries: littleChunk.map((book) => ({
              Id: book.Num,
              MessageBody: JSON.stringify(book),
            })),
            QueueUrl: process.env.SQS_QUEUE_URL as string,
          })
        )
      )
    );
  }
};

const dynamo = new DynamoDBClient({ apiVersion: '2012-08-10' });

const handleBook = async (book: GutenbergBook): Promise<void> => {
  const { text } = await findBook(book);
  const snippets = findPhrasings(text);
  await dynamo.send(
    new PutItemCommand({
      TableName: 'gutenberg-valditity-info',
      Item: marshall({
        id: book['gd-num-padded'],
        metadata: book,
        count: snippets.length,
      }),
      ReturnValues: 'NONE',
    })
  );
};

export const dequeuer: AWSLambda.SQSHandler = (event) =>
  Promise.all(event.Records.map((r) => handleBook(JSON.parse(r.body)))).then(
    (as) => {
      console.log(`processed ${as.length} books`);
    }
  );
