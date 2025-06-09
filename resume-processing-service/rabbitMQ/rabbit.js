const amqplib = require('amqplib');
const rabbitUrl = process.env.RABBIT_URL || 'amqps://txgyauhc:HVMipKIXKdFI72UHZnM3u7b7C7NcWGuJ@fuji.lmq.cloudamqp.com/txgyauhc';

let channel;

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

const subscribeToQueue = async (queue, callback) => {
  if (!channel) {
    await setupRabbitMQ();
  }

  console.log("subscribing to queue", queue);

  await channel.assertQueue(queue, { durable: true });
  channel.consume(queue, (msg) => {
    if (msg !== null) {
      callback(msg.content.toString());
      channel.ack(msg);
    }
  });

  // console.log("subscribed to queue", queue);
};

const publishToQueue = async (queue, message) => {
  if (!channel) {
    await setupRabbitMQ();
  }

  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(message), { persistent: true });
};

module.exports = {subscribeToQueue, publishToQueue };
