using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data
{
    public static class Config
    {
        public const string BasePath = "..\\..\\..\\..\\..\\";
        public const string DeployPath = BasePath + "gt\\Garland.Web\\";
        public const string ServerPath = "..\\Garland.Server\\";
        public const string SupplementalPath = "..\\..\\..\\Supplemental\\";
        public const string UpdatesPath = "..\\..\\..\\..\\Updates\\";
        public const string FilesPath = "E:\\gtfiles\\";
        public const string IconPath = FilesPath + "icons\\";

        public const string ImageMagickPath = @"C:\Users\Chris\Projects\ffxiv\ImageMagick-6.9.1-2-Q16-x86-windows\ImageMagick-6.9.1-2\convert.exe";
        public const string DiffPath = @"C:\Users\Chris\Dropbox\Computer\Apps\WinMerge-2.14.0-exe\WinMergeU.exe";
        public const string FfmpegPath = @"C:\Users\Chris\Dropbox\Computer\Apps\ffmpeg-20180619-a990184-win64-static\bin\ffmpeg.exe";

        public const string ConnectionString = "Persist Security Info=False;database=keystore;server=localhost;user id=keystore;pwd=configure-me;CharSet=utf8";
    }
}
