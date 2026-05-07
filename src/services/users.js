import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import User from "../models/User.js";
import { dynamo } from "./dynamodb.js";

const getUsersTable = () => {
  if (!process.env.DYNAMODB_USERS_TABLE) {
    throw new Error("Missing DYNAMODB_USERS_TABLE in .env");
  }

  return process.env.DYNAMODB_USERS_TABLE;
};

export async function getUserById(userId) {
  const result = await dynamo.send(
    new GetCommand({
      TableName: getUsersTable(),
      Key: { userId },
    })
  );

  return User.fromItem(result.Item);
}

export async function getOrCreateUser(authUser) {
  const existingUser = await getUserById(authUser.userId);
  if (existingUser) return existingUser;

  const user = User.fromAuth(authUser);

  await dynamo.send(
    new PutCommand({
      TableName: getUsersTable(),
      Item: user.toItem(),
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );

  return user;
}

export async function updateDeepDiveBookmarks(userId, deepDiveBookmarks) {
  const now = new Date().toISOString();

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: getUsersTable(),
      Key: { userId },
      UpdateExpression: "SET deepDiveBookmarks = :deepDiveBookmarks, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":deepDiveBookmarks": deepDiveBookmarks,
        ":updatedAt": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return User.fromItem(result.Attributes);
}

export async function updateUserProgress(userId, progress) {
  const now = new Date().toISOString();

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: getUsersTable(),
      Key: { userId },
      UpdateExpression: "SET deepDiveProgress = :deepDiveProgress, timelineProgress = :timelineProgress, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":deepDiveProgress": progress.deepDiveProgress || {},
        ":timelineProgress": progress.timelineProgress || {},
        ":updatedAt": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return User.fromItem(result.Attributes);
}
