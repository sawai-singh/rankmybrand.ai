#!/usr/bin/env node

const WebSocket = require('ws');

console.log('Testing WebSocket connections...\n');

// Test WebSocket Server on port 3001
console.log('1. Testing WebSocket Server (ws://localhost:3001/ws)');
const ws1 = new WebSocket('ws://localhost:3001/ws');

ws1.on('open', () => {
  console.log('   ✅ Connected to WebSocket Server');
  ws1.send(JSON.stringify({ type: 'ping' }));
});

ws1.on('message', (data) => {
  console.log('   📨 Received:', data.toString());
});

ws1.on('error', (error) => {
  console.log('   ❌ Error:', error.message);
});

setTimeout(() => {
  ws1.close();
  
  // Test API Gateway WebSocket on port 4000
  console.log('\n2. Testing API Gateway WebSocket (ws://localhost:4000/ws)');
  const ws2 = new WebSocket('ws://localhost:4000/ws');
  
  ws2.on('open', () => {
    console.log('   ✅ Connected to API Gateway WebSocket');
    ws2.send(JSON.stringify({ type: 'ping' }));
  });
  
  ws2.on('message', (data) => {
    console.log('   📨 Received:', data.toString());
  });
  
  ws2.on('error', (error) => {
    console.log('   ❌ Error:', error.message);
  });
  
  setTimeout(() => {
    ws2.close();
    console.log('\n✅ Test complete');
    process.exit(0);
  }, 2000);
}, 2000);