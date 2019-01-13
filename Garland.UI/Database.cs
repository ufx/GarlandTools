using Garland.Data;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.UI
{
    public static class Database
    {
        public static void WithConnection(Action<MySqlConnection> action)
        {
            using (var conn = new MySqlConnection(Config.ConnectionString))
            {
                try
                {
                    conn.Open();
                }
                catch (MySqlException ex)
                {
                    Data.DatabaseBuilder.Printer.PrintLine(ex.Message);
                    return;
                }

                action(conn);
            }
        }

        public static int ExecuteNonQuery(MySqlConnection conn, string sql)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = sql;
                cmd.CommandTimeout = 60;
                return cmd.ExecuteNonQuery();
            }
        }

        public static object ExecuteScalar(MySqlConnection conn, string sql)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = sql;
                return cmd.ExecuteScalar();
            }
        }
    }
}
