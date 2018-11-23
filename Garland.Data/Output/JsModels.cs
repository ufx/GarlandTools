using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Garland.Data.Output
{
    public class JsPartial
    {
        public string Type;

        public string Id;

        public JObject Obj;

        public JsPartial() { }

        public JsPartial(string type, string id, JObject obj)
        {
            Type = type;
            Id = id;
            Obj = obj;
        }

        public void WriteTo(JsonWriter writer)
        {
            writer.WriteStartObject();

            writer.WritePropertyName("type");
            writer.WriteValue(Type);

            writer.WritePropertyName("id");
            writer.WriteValue(Id);

            writer.WritePropertyName("obj");
            Obj.WriteTo(writer);

            writer.WriteEndObject();
        }
    }

    public class WrapperConverter : JsonConverter
    {
        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            var wrapper = (JsWrapper)value;

            writer.WriteStartObject();

            // Type object
            writer.WritePropertyName(wrapper.Type);
            if (GarlandDatabase.LocalizedTypes.Contains(wrapper.Type))
            {
                // Copy the object and absorb language string.
                var data = GetLocalizedData((JObject)wrapper.Data, wrapper.Lang);
                data.WriteTo(writer, this);
            }
            else
            {
                // Just an array or other token, no language data.
                wrapper.Data.WriteTo(writer, this);
            }

            // Leve rewards
            if (wrapper.Rewards != null)
            {
                writer.WritePropertyName("rewards");
                wrapper.Rewards.WriteTo(writer, this);
            }

            // Crafting ingredients
            if (wrapper.Ingredients != null)
            {
                writer.WritePropertyName("ingredients");
                writer.WriteStartArray();
                foreach (var ingredient in wrapper.Ingredients)
                {
                    var data = GetLocalizedData(ingredient, wrapper.Lang);
                    data.WriteTo(writer, this);
                }
                writer.WriteEndArray();
            }

            // Partial array
            if (wrapper.Partials != null)
            {
                writer.WritePropertyName("partials");
                writer.WriteStartArray();
                foreach (var partial in wrapper.Partials)
                    partial.WriteTo(writer);
                writer.WriteEndArray();
            }

            writer.WriteEndObject();
        }

        public static JObject GetLocalizedData(JObject source, string lang)
        {
            var data = new JObject(source);

            var strings = data[lang];
            data.Remove("en");
            data.Remove("fr");
            data.Remove("de");
            data.Remove("ja");

            foreach (JProperty prop in strings.Reverse())
                data.AddFirst(new JProperty(prop));

            return data;
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            throw new NotImplementedException();
        }

        public override bool CanRead => false;
        public override bool CanConvert(Type t) => t == typeof(JsWrapper);
    }

    public class JsWrapper
    {
        public string Type;
        public JToken Data;
        public List<JsPartial> Partials;
        public List<JObject> Ingredients;
        public JToken Rewards;
        public string Lang;

        public JsWrapper(string lang, string type, JToken data)
        {
            Lang = lang;
            Type = type;
            Data = data;
        }
    }
}
