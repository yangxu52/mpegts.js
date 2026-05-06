
Livestream playback
===================
You need to provide a livestream URL in `MediaDataSource` and indicates `isLive: true`.

Sample MPEG2-TS over HTTP source:

```js
{
    // MPEG2-TS over HTTP
    "type": "mpegts",
    "isLive": true,
    "url": "http://127.0.0.1:8080/live/livestream.ts"
}
```

Sample HTTP FLV source:

```js
{
    // HTTP FLV
    "type": "flv",
    "isLive": true,
    "url": "http://127.0.0.1:8080/live/livestream.flv"
}
```

Or a WebSocket source:

```js
{
    // MPEG2-TS/FLV over WebSocket
    "type": "mse",
    "isLive": true,
    "url": "ws://127.0.0.1:9090/live/livestream.flv"
}
```

## HTTP MPEG2-TS/FLV live stream

### CORS
You must configure `Access-Control-Allow-Origin` header correctly on your stream server.

See [cors.md](../docs/cors.md) for details.

### Compatibility
mpegts.js runtime support requires both ES6 and `ReadableStream`, while explicitly excluding pre-Chromium Edge. The public browser matrix takes the higher version requirement of the two baselines: Chrome 52+, Edge 79+, Safari 10.1+, Firefox 65+, Opera 39+ ([Can I Use: ES6][caniuse-es6], [Can I Use: ReadableStream][caniuse-readablestream]).

- Chrome / Edge (Chromium): `FetchStreamLoader` is used when `fetch` and `ReadableStream` are available
- FireFox: `FetchStreamLoader` is used on Firefox 65+; the codebase still contains a `moz-chunked-arraybuffer` fallback path as an implementation detail
- Safari: `FetchStreamLoader` is used on Safari 10.1+

Legacy browsers such as IE11 and pre-Chromium Edge are not supported.

[fetch]: https://fetch.spec.whatwg.org/
[stream]: https://streams.spec.whatwg.org/
[caniuse-es6]: https://caniuse.com/es6
[caniuse-readablestream]: https://caniuse.com/mdn-api_readablestream_readablestream
