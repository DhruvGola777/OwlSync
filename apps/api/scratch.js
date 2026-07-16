import * as otplib from 'otplib';
const secret = otplib.generateSecret();
console.log('Secret:', secret);
const uri = otplib.generateURI({ accountName: 'test@test.com', issuer: 'OwlSync', secret });
console.log('URI:', uri);
console.log('Verify:', otplib.verify({ token: '123456', secret }));
