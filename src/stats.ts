/* eslint-disable no-await-in-loop */
import AWS from 'aws-sdk';
import chunk from 'lodash/chunk';
import { findBook, findPhrasings, GutenbergBook, metadata } from './post';

export const enqueuer: AWSLambda.Handler = async () => {
  const books = await metadata();
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05', region: 'us-east-1' });
  const chunks = chunk(books, 50);
  for (let i = 0; i < chunks.length; i += 1) {
    const bigChunk = chunks[i];
    await Promise.all(
      chunk(bigChunk, 10).map((littleChunk) =>
        sqs
          .sendMessageBatch({
            Entries: littleChunk.map((book) => ({
              Id: book.Num,
              MessageBody: JSON.stringify(book),
            })),
            QueueUrl: process.env.SQS_QUEUE_URL as string,
          })
          .promise()
      )
    );
  }
};

const dynamo = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const handleBook = async (book: GutenbergBook): Promise<void> => {
  const { text } = await findBook(book);
  const snippets = findPhrasings(text);
  await dynamo
    .put({
      TableName: 'gutenberg-valditity-info',
      Item: {
        id: book['gd-num-padded'],
        metadata: book,
        count: snippets.length,
      },
      ReturnValues: 'NONE',
    })
    .promise();
};

export const dequeuer: AWSLambda.SQSHandler = (event) =>
  Promise.all(event.Records.map((r) => handleBook(JSON.parse(r.body)))).then(
    (as) => {
      console.log(`processed ${as.length} books`);
    }
  );
