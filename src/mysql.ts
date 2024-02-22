import type {
  ColumnType,
  ConnectionInfo,
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from "@prisma/driver-adapter-utils";
import { Debug, err, ok } from "@prisma/driver-adapter-utils";
import {
  type FieldPacket,
  type Pool,
  type PoolConnection,
  type QueryOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { UnsupportedNativeDataType, fieldToColumnType, typeCast } from "./conversion";

const debug = Debug("prisma:driver-adapter:mysql");

type QueryResult<T> = {
  data: T;
  fields: FieldPacket[];
};

type MySqlError = Error & {
  code?: number;
  state: string;
};

class MySqlQueryable<ClientT extends Pool | PoolConnection> implements Queryable {
  readonly provider = "mysql";

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = "[js::query_raw]";
    debug(`${tag} %O`, query);

    const res = await this.performIO({
      sql: query.sql,
      values: query.args,
      rowsAsArray: true,
      typeCast,
    });

    if (!res.ok) {
      return err(res.error);
    }

    const { data, fields } = res.value;
    const columnNames = fields.map((field) => field.name);
    const rows = Array.isArray(data) ? data : [];
    const lastInsertId = "insertId" in data ? data.insertId.toString() : undefined;

    let columnTypes: ColumnType[] = [];

    try {
      columnTypes = fields.map((field) => fieldToColumnType(field));
    } catch (error) {
      if (error instanceof UnsupportedNativeDataType) {
        return err({ kind: "UnsupportedNativeDataType", type: error.type });
      }
      throw error;
    }

    return ok({
      columnNames,
      columnTypes,
      rows,
      lastInsertId,
    });
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = "[js::execute_raw]";
    debug(`${tag} %O`, query);

    const res = await this.performIO<ResultSetHeader>({ sql: query.sql, values: query.args });

    if (!res.ok) {
      return err(res.error);
    }

    return res.map(({ data }) => data.affectedRows);
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO<T extends ResultSetHeader | RowDataPacket[][]>(
    options: QueryOptions,
  ): Promise<Result<QueryResult<T>>> {
    try {
      const [data, fields = []] = await this.client.query<T>(options);
      return ok({ data, fields });
    } catch (e) {
      const error = e as MySqlError;
      debug("Error in performIO: %O", error);
      if (error?.code) {
        return err({
          kind: "Mysql",
          code: error.code,
          message: error.message,
          state: error.state,
        });
      }
      throw error;
    }
  }
}

class MySqlTransaction extends MySqlQueryable<PoolConnection> implements Transaction {
  constructor(client: PoolConnection, readonly options: TransactionOptions) {
    super(client);
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`);

    this.client.release();
    return ok(undefined);
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`);

    this.client.release();
    return ok(undefined);
  }
}

export type PrismaMySqlOptions = {
  schema?: string;
};

export class PrismaMySql extends MySqlQueryable<Pool> implements DriverAdapter {
  constructor(client: Pool, private options?: PrismaMySqlOptions) {
    super(client);
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      schemaName: this.options?.schema,
    });
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    };

    const tag = "[js::startTransaction]";
    debug(`${tag} options: %O`, options);

    const connection = await this.client.getConnection();
    return ok(new MySqlTransaction(connection, options));
  }
}
