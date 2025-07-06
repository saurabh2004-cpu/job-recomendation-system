const amqplib = require('amqplib');
const rabbitUrl = process.env.RABBIT_URL || 'amqps://txgyauhc:HVMipKIXKdFI72UHZnM3u7b7C7NcWGuJ@fuji.lmq.cloudamqp.com/txgyauhc';

let channel;
const consumerTags = new Map()

const setupRabbitMQ = async () => {
  try {
    console.log("connecting to RabbitMQ...");
    const connection = await amqplib.connect(rabbitUrl);
    channel = await connection.createChannel();
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ', error);
  }
};

const subscribeToQueue = async (queue, callback, emailId = "") => {
  if (!channel) {
    await setupRabbitMQ();
  }
  console.log("subscribing to queue", queue);

  const consumer = await channel.assertQueue(queue, { durable: true }); // Ensure the queue exists
  channel.consume(queue, (msg) => {
    if (msg !== null) {
      callback(msg.content.toString());
      channel.ack(msg);
    }
  });

  console.log("consumer tag",consumer)

  // FIXED: store the consumer tag correctly in the map
  consumerTags.set(emailId, consumer.queue);

  console.log(`Subscribed to ${queue} with tag `,consumer.queue);
};

const unsubscribeFromQueue = async (emailId) => {
  const consumerTag = consumerTags.get(emailId)
  if (consumerTag) {
    await channel.cancel(consumerTag) //stops consuming msg
    consumerTag.delete(emailId) //delet fro map
    console.log(`Unsubscribed ${emailId} from queue`);
  }
}

const publishToQueue = async (queue, message) => {
  if (!channel) {
    await setupRabbitMQ();
  }

  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(message), { persistent: true });
};

module.exports = { subscribeToQueue, publishToQueue,unsubscribeFromQueue };
