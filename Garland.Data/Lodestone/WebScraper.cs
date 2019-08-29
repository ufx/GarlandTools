using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Garland.Data.Lodestone
{
    public class WebScraper
    {
        protected int _sleepMin = 10;
        protected int _sleepMax = 40;
        private Random _random = new Random();

        protected string Request(string url)
        {
            var response = GetResponse(url);
            var reader = new StreamReader(response.GetResponseStream());
            return reader.ReadToEnd();
        }

        protected byte[] RequestBytes(string url)
        {
            var response = GetResponse(url);

            var bytes = new byte[response.ContentLength];
            var stream = response.GetResponseStream();

            int b;
            var i = 0;
            while ((b = stream.ReadByte()) != -1)
                bytes[i++] = (byte)b;

            return bytes;
        }

        private WebResponse GetResponse(string url)
        {
            var sleep = _random.Next(_sleepMin, _sleepMax);
            Thread.Sleep(sleep);

            for (var i = 0; i < 5; i++)
            {
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create(url);
                    request.UserAgent = "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36";
                    return request.GetResponse();
                }
                catch (WebException ex)
                {
                    System.Diagnostics.Debug.WriteLine(ex.Message);

                    if (ex.Message.Contains("Bad Gateway"))
                    {
                        Thread.Sleep(3000);
                        continue;
                    }
                    else
                        throw;
                }
            }

            throw new InvalidOperationException("Too many failures retrieving: " + url);
        }
    }
}
