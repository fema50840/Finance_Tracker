// src/swagger.ts
export const openapiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Finance Tracker API",
      version: "1.0.0",
    },
    servers: [
      { url: "http://localhost:3001" }
    ],
    tags: [
      { name: "Health" },
      { name: "Transactions" },
      { name: "Summary" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { type: "boolean" } },
                    required: ["ok"],
                  },
                },
              },
            },
          },
        },
      },
  
      "/api/transactions": {
        get: {
          tags: ["Transactions"],
          summary: "Get all transactions",
          responses: {
            200: {
              description: "List of transactions",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Transaction" },
                  },
                },
              },
            },
          },
        },
  
        post: {
          tags: ["Transactions"],
          summary: "Create transaction",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTransactionDto" },
                example: {
                  date: "2026-02-19",
                  card: 1,
                  category: "Food",
                  type: "outcome",
                  amount: "12.34",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Created transaction",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Transaction" },
                },
              },
            },
            400: {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
  
      "/api/transactions/{id}": {
        delete: {
          tags: ["Transactions"],
          summary: "Delete transaction by id",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Transaction id (as string, because DB id may be BigInt)",
            },
          ],
          responses: {
            200: {
              description: "Deleted transaction",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Transaction" },
                },
              },
            },
            400: {
              description: "Delete failed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
  
      "/api/summary": {
        get: {
          tags: ["Summary"],
          summary: "Get totals summary",
          responses: {
            200: {
              description: "Summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Summary" },
                },
              },
            },
          },
        },
      },
    },
  
    components: {
      schemas: {
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            date: { type: "string", format: "date-time" },
            card: { type: "integer", enum: [1, 2, 3, 4] },
            category: { type: "string" },
            type: { type: "string", enum: ["income", "outcome"] },
            amount: { type: "string" },
            currency: { type: "string", enum: ["RUB", "EUR"] },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "date", "card", "category", "type", "amount", "currency"],
        },
  
        CreateTransactionDto: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
            card: { type: "integer", enum: [1, 2, 3, 4] },
            category: { type: "string" },
            type: { type: "string", enum: ["income", "outcome"] },
            amount: { type: "string", description: "decimal as string (e.g. 12.34)" },
            currency: { type: "string", enum: ["RUB", "EUR"], default: "RUB" },
          },
          required: ["date", "card", "category", "type", "amount"],
        },
  
        Summary: {
          type: "object",
          properties: {
            total: { type: "number" },
            totalsByCard: {
              type: "object",
              additionalProperties: { type: "number" },
            },
          },
          required: ["total", "totalsByCard"],
        },
  
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
          required: ["error"],
        },
      },
    },
  } as const;
  
