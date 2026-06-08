import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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
  if (existingUser) {
    if (
      (authUser.name && authUser.name !== existingUser.name) ||
      (authUser.email && authUser.email !== existingUser.email)
    ) {
      const result = await dynamo.send(
        new UpdateCommand({
          TableName: getUsersTable(),
          Key: { userId: authUser.userId },
          UpdateExpression: "SET #name = :name, email = :email, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: {
            ":name": authUser.name || existingUser.name,
            ":email": authUser.email || existingUser.email,
            ":updatedAt": new Date().toISOString(),
          },
          ReturnValues: "ALL_NEW",
        })
      );
      return User.fromItem(result.Attributes);
    }

    return existingUser;
  }

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

export async function getAllSuggestions() {
  const suggestions = [];
  let exclusiveStartKey;

  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: getUsersTable(),
        ProjectionExpression: "userId, #name, email, suggestions",
        ExpressionAttributeNames: { "#name": "name" },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    for (const item of result.Items || []) {
      for (const suggestion of item.suggestions || []) {
        suggestions.push({
          ...suggestion,
          userId: item.userId,
          userName: item.name || "",
          userEmail: item.email || "",
        });
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return suggestions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addUserSuggestion(userId, suggestion) {
  const now = new Date().toISOString();

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: getUsersTable(),
      Key: { userId },
      UpdateExpression:
        "SET suggestions = list_append(if_not_exists(suggestions, :empty), :suggestion), updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":empty": [],
        ":suggestion": [suggestion],
        ":updatedAt": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return User.fromItem(result.Attributes);
}

export async function updateSuggestionStatus(userId, suggestionId, status) {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const index = user.suggestions.findIndex(s => s.suggestionId === suggestionId);
  if (index === -1) throw new Error("Suggestion not found");

  const now = new Date().toISOString();

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: getUsersTable(),
      Key: { userId },
      UpdateExpression: `SET suggestions[${index}].#status = :status, suggestions[${index}].updatedAt = :updatedAt, updatedAt = :updatedAt`,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return User.fromItem(result.Attributes);
}


