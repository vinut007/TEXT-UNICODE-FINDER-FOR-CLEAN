// Reproduce mdb-reader + buffer polyfill behavior in Node
const { Buffer: PolyBuffer } = require('buffer');

// Simulate what the worker does
function testBufferOps() {
  // Fake a tiny non-Access buffer to see what fails first
  const ab = new ArrayBuffer(4096);
  const bytes = new Uint8Array(ab);
  bytes[0] = 0; // page type 0 = DatabaseDefinitionPage
  bytes[0x14] = 0x01; // Jet4

  const buf = PolyBuffer.from(bytes);
  console.log('PolyBuffer length:', buf.length);
  console.log('has slice:', typeof buf.slice);
  console.log('has copy:', typeof buf.copy);
  console.log('has readUInt16LE:', typeof buf.readUInt16LE);
  console.log('has readUInt8:', typeof buf.readUInt8);
  console.log('has toString:', typeof buf.toString);
  console.log('byte 0:', buf[0], 'byte 0x14:', buf[0x14]);

  // What mdb-reader does: buffer.slice(offset, offset+size)
  const sliced = buf.slice(0, 128);
  console.log('slice ok, length:', sliced.length);

  // Buffer.alloc
  const alloc = PolyBuffer.alloc(4096);
  console.log('alloc ok, length:', alloc.length);

  // Buffer.from(array)
  const fromArr = PolyBuffer.from([1, 2, 3, 4]);
  console.log('from array ok:', fromArr.length);

  // copy
  alloc.copy(buf, 0, 0, 128);
  console.log('copy ok');
}

testBufferOps();
