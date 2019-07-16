using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public static class SqlDatabase
    {
        public static void WithConnection(string connectionString, Action<MySqlConnection> action)
        {
            using (var conn = new MySqlConnection(connectionString))
            {
                try
                {
                    conn.Open();
                }
                catch (DbException ex)
                {
                    DatabaseBuilder.Printer.PrintLine(ex.Message);
                    return;
                }

                action(conn);
            }
        }

        public static void WithReader(string connectionString, string sql, Action<MySqlDataReader> action)
        {
            WithConnection(connectionString, conn =>
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = sql;
                    using (var reader = cmd.ExecuteReader())
                        action(reader);
                }
            });
        }

        public static int ExecuteNonQuery(IDbConnection conn, string sql)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = sql;
                cmd.CommandTimeout = 180;
                return cmd.ExecuteNonQuery();
            }
        }

        public static object ExecuteScalar(IDbConnection conn, string sql)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = sql;
                return cmd.ExecuteScalar();
            }
        }
    }
}
