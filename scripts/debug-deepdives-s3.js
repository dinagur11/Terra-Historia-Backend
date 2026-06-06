import "dotenv/config";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bucket = process.env.S3_DEEPDIVES_BUCKET;

const keys = [
  "wwi-events.json",
  "deepdives-drafts/wwi-events.json",
  "wwi-events",
  "WWI-events.json",
];

for (const key of keys) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log("HEAD OK", key, head.ContentLength, head.ContentType);
  } catch (err) {
    console.log("HEAD FAIL", key, err.name, err.Code || err.message);
  }
}

try {
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: "wwi", MaxKeys: 20 })
  );
  console.log(
    "LIST wwi",
    (listed.Contents || []).map((object) => `${object.Key} (${object.Size})`).join("\n")
  );
} catch (err) {
  console.log("LIST FAIL", err.name, err.Code || err.message);
}

try {
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: "wwi-events.json" })
  );
  const text = await obj.Body.transformToString();
  console.log("FIRST CHARS", text.slice(0, 120));
  JSON.parse(text);
  console.log("JSON OK");
} catch (err) {
  console.log("GET/PARSE FAIL", err.name, err.Code || err.message);
}
