import dgram from 'react-native-udp';
import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';

const UDP_PORT = 5000;
const TCP_PORT = 6000;
let discoveredServerIP = '';

// 🔵 **Step 1: Discover Server Over UDP**
const discoverServer = () => {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reusePort: true });

    socket.bind(UDP_PORT, () => {
      socket.setBroadcast(true);
      console.log('Listening for server discovery...');

      socket.on('message', (msg, rinfo) => {
        const message = msg.toString();
        if (message.startsWith('DISCOVERY:')) {
          const [, serverIP, port] = message.split(':');
          discoveredServerIP = serverIP;
          console.log(`Discovered server at ${serverIP}:${port}`);
          socket.close();
          resolve(serverIP);
        }
      });
    });

    setTimeout(() => reject('No server discovered'), 10000);
  });
};

// 🟢 **Step 2: Connect to TCP Server and Send File**
const connectAndSendFile = async (filePath: string) => {
  if (!discoveredServerIP) {
    console.error('No server discovered yet.');
    return;
  }

  return new Promise((resolve, reject) => {
    const client = TcpSocket.createConnection({ port: TCP_PORT, host: discoveredServerIP }, async () => {
      console.log('Connected to server:', discoveredServerIP);

      try {
        const fileData = await RNFS.readFile(filePath, 'base64');
        client.write("fileData");
        client.end();
        console.log('File sent successfully!');
        resolve("OK");
      } catch (error) {
        console.error('File Read Error:', error);
        client.destroy();
        reject(error);
      }
    });

    client.on('error', (error) => reject(error));
    client.on('close', () => console.log('Connection closed'));
  });
};

export { discoverServer, connectAndSendFile };
