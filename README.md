# @babrasoft/prisma-mysql-adapter

This package contains the driver adapter for Prisma ORM that enables usage of the [`node-mysql`](https://sidorares.github.io/node-mysql2/) (`mysql2`) database driver for MySQL.

`mysql2` is one of the most popular drivers in the JavaScript ecosystem for MySQL databases. It can be used with any MySQL database that's accessed via TCP.

> **Note:** Support for the `mysql` driver is available from Prisma versions [5.4.0](https://github.com/prisma/prisma/releases/tag/5.4.0) and later.

## Usage

This section explains how you can use it with Prisma ORM and the `@babrasoft/prisma-mysql-adapter` driver adapter. Be sure that the `DATABASE_URL` environment variable is set to your MySQL connection string (e.g. in a `.env` file).

### 1. Enable the `driverAdapters` Preview feature flag

Since driver adapters are currently in [Preview](https://www.prisma.io/docs/orm/more/releases#preview), you need to enable its feature flag on the `datasource` block in your Prisma schema:

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Once you have added the feature flag to your schema, re-generate Prisma Client:

```
npx prisma generate
```

### 2. Install the dependencies

Next, install the `mysql2` package and our driver adapter:

```
npm install mysql2
npm install @babrasoft/prisma-mysql-adapter
```

### 3. Instantiate Prisma Client using the driver adapter

Finally, when you instantiate Prisma Client, you need to pass an instance of our driver adapter to the `PrismaClient` constructor:

```ts
import { createPool } from "mysql2";
import { PrismaMySql } from "@babrasoft/prisma-mysql-adapter";
import { PrismaClient } from "@prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

const pool = createPool(connectionString);
const adapter = new PrismaMySql(pool);
const prisma = new PrismaClient({ adapter });
```

## Feedback

This is an **unofficial** driver adapter until Prisma makes an official driver adapter for MySQL.

If you find something missing or run into a bug, please create an issue.
