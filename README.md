## Build

cd client && yarn install && tsc
cd server && yarn install && tsc

如果要重新编译msg.fbs, 分别在client和server中执行flatc -T -o src/ ../msg.fbs

## Run Example

1.cd client && yarn dev

2.node server/example/app.js

3.open localhost:8100