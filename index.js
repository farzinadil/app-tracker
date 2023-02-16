const Imap = require('imap');
const { simpleParser } = require('mailparser');
const dotenv = require('dotenv');

dotenv.config();

const username = process.env.EMAIL_USERNAME;
const password = process.env.EMAIL_PASSWORD;

const imapConfig = {
  user: username,
  password: password,
  host: 'imap.gmail.com',
  port: 993,
  tls: true
};

const searchCriteria = ['TEXT "thank you for applying to"'];

const parseEmail = async (emailData, date) => {
  const parsedEmail = await simpleParser(emailData);
  const text = parsedEmail.text;
  const index = text.indexOf('thank you for applying to');
  if (index !== -1) {
    const company = text.substring(index + 'thank you for applying to'.length).split('\n')[0];
    return { date, name_of_company: company };
  }
  return null;
};

const searchAndParse = async () => {
  return new Promise((resolve, reject) => {
    const imapConnection = new Imap(imapConfig);
    const results = [];

    imapConnection.once('ready', () => {
      imapConnection.search(searchCriteria, (err, messageIds) => {
        if (err) {
          reject(err);
        }
        const messageCount = messageIds.length;
        let processedCount = 0;
        messageIds.forEach((messageId) => {
          const fetchOptions = { bodies: '' };
          const fetchRequest = imapConnection.fetch(messageId, fetchOptions);
          fetchRequest.on('message', (msg) => {
            let emailData = '';
            let emailDate = '';
            msg.on('body', (stream, info) => {
              stream.on('data', (chunk) => {
                emailData += chunk.toString('utf8');
              });
            });
            msg.on('attributes', (attrs) => {
              emailDate = attrs.date.toISOString();
            });
            msg.once('end', async () => {
              const parsedEmail = await parseEmail(emailData, emailDate);
              if (parsedEmail !== null) {
                results.push(parsedEmail);
              }
              processedCount++;
              if (processedCount === messageCount) {
                imapConnection.end();
                resolve(results);
              }
            });
          });
          fetchRequest.on('error', (err) => reject(err));
        });
        if (messageCount === 0) {
          imapConnection.end();
          resolve(results);
        }
      });
    });

    imapConnection.once('error', (err) => reject(err));
    imapConnection.once('end', () => console.log('Connection ended.'));
    imapConnection.connect();
  });
};

searchAndParse()
  .then((results) => console.log(JSON.stringify(results, null, 2)))
  .catch((err) => console.error(err));
