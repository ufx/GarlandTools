using Garland.Data.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Saint = SaintCoinach.Xiv;

namespace Garland.Data.Modules
{
    public class Recipes : Module
    {
        public override string Name => "Recipes";

        public override void Start()
        {
            BuildItemRecipes();
            BuildCompanyCraftRecipes();
            BuildCompanyCraftDrafts();
        }

        void BuildItemRecipes()
        {
            foreach (var sRecipe in _builder.Sheet<SaintCoinach.Xiv.Recipe>())
            {
                if (!_builder.Db.ItemsById.TryGetValue(sRecipe.ResultItem.Key, out var item))
                {
                    if (!string.IsNullOrWhiteSpace(sRecipe.ResultItem.Name))
                        DatabaseBuilder.PrintLine($"Skipping recipe for {sRecipe.ResultItem.Key}: {sRecipe.ResultItem.Name}");
                    continue;
                }

                dynamic recipe = new JObject();
                recipe.id = sRecipe.Key;
                recipe.job = sRecipe.ClassJob.Key;
                recipe.rlvl = sRecipe.RecipeLevelTable.Key;
                recipe.durability = sRecipe.RecipeLevel.Durability;
                recipe.quality = sRecipe.RecipeLevel.Quality;
                recipe.progress = sRecipe.RecipeLevel.Difficulty;
                recipe.lvl = sRecipe.RecipeLevelTable.ClassJobLevel;

                if (sRecipe.RecipeLevelTable.Stars > 0)
                    recipe.stars = sRecipe.RecipeLevelTable.Stars;

                if (sRecipe.ResultCount != 1)
                    recipe.yield = sRecipe.ResultCount;

                if (sRecipe.CanHq)
                    recipe.hq = 1;

                if (sRecipe.CanQuickSynth)
                    recipe.quickSynth = 1;

                if (sRecipe.RequiredControl > 0)
                    recipe.controlReq = sRecipe.RequiredControl;

                if (sRecipe.RequiredCraftsmanship > 0)
                    recipe.craftsmanshipReq = sRecipe.RequiredCraftsmanship;

                if (sRecipe.QuickSynthCraftsmanship > 0)
                    recipe.quickSynthCraftsmanship = sRecipe.QuickSynthCraftsmanship;

                if (sRecipe.QuickSynthControl > 0)
                    recipe.quickSynthControl = sRecipe.QuickSynthControl;

                if (sRecipe.IsSpecializationRequired)
                    recipe.special = sRecipe.ClassJob.SoulCrystal.Key;

                if (sRecipe.UnlockItem != null)
                {
                    recipe.unlockId = sRecipe.UnlockItem.Key;
                    var unlockItem = _builder.Db.ItemsById[sRecipe.UnlockItem.Key];
                    if (unlockItem.unlocks == null)
                        unlockItem.unlocks = new JArray();
                    unlockItem.unlocks.Add(sRecipe.ResultItem.Key);
                    _builder.Db.AddReference(unlockItem, "item", sRecipe.ResultItem.Key, false);
                    _builder.Db.AddReference(item, "item", sRecipe.UnlockItem.Key, true);
                }

                recipe.ingredients = new JArray();
                foreach (var ingredient in sRecipe.Ingredients)
                    recipe.ingredients.Add(ConvertIngredient(new IngredientModel(ingredient), item));

                if (item.craft == null)
                    item.craft = new JArray(recipe);
                else
                    item.craft.Add(recipe);
            }
        }

        void BuildCompanyCraftRecipes()
        {
            var sAirshipExplorationParts = _builder.Sheet("AirshipExplorationPart");
            foreach (var sCompanyCraftSequence in _builder.Sheet<Saint.CompanyCraftSequence>())
            {
                if (sCompanyCraftSequence.ResultItem.Key == 0)
                    continue;

                var resultItem = _builder.Db.ItemsById[sCompanyCraftSequence.ResultItem.Key];

                // Create the recipe.
                dynamic recipe = new JObject();
                recipe.id = "fc" + sCompanyCraftSequence.Key;
                recipe.job = 0; // Adventurer for now.
                recipe.rlvl = 1;
                recipe.lvl = 1;
                recipe.fc = 1;
                recipe.ingredients = new JArray();

                // Collect ingredient data.
                var ingredients = new List<IngredientModel>();
                foreach (var sCompanyCraftPart in sCompanyCraftSequence.CompanyCraftParts)
                {
                    var part = sCompanyCraftPart.CompanyCraftType.Name.ToString();
                    var phase = 0;

                    var processes = sCompanyCraftPart.CompanyCraftProcesses.ToArray();
                    foreach (var sCompanyCraftProcess in processes)
                    {
                        if (processes.Length > 1) // Only record the phase if there's more than 1.
                            phase++;

                        foreach (var sRequest in sCompanyCraftProcess.Requests)
                            ingredients.Add(new IngredientModel(sRequest.SupplyItem.Item, sRequest.TotalQuantity, part, phase));
                    }
                }

                if (ingredients.Count == 0)
                    throw new InvalidOperationException();

                foreach (var ingredient in ingredients)
                    recipe.ingredients.Add(ConvertIngredient(ingredient, resultItem));

                // Store the recipe.
                if (resultItem.craft == null)
                    resultItem.craft = new JArray(recipe);
                else
                    resultItem.craft.Add(recipe);

                // If it's an airship part, stash that info too.
                if (sCompanyCraftSequence.CompanyCraftDraftCategory.Name.ToString() == "Airships")
                {
                    var key = sCompanyCraftSequence.Key - 499;
                    var airshipPart = sAirshipExplorationParts[key];

                    if (resultItem.attr == null)
                        resultItem.attr = new JObject();
                    resultItem.attr.Rank = airshipPart["Rank"];
                    resultItem.attr.Components = airshipPart["Components"];
                    resultItem.attr.Surveillance = airshipPart["Surveillance"];
                    resultItem.attr.Retrieval = airshipPart["Retrieval"];
                    resultItem.attr.Speed = airshipPart["Speed"];
                    resultItem.attr.Range = airshipPart["Range"];
                    resultItem.attr.Favor = airshipPart["Favor"];
                    resultItem.attr.Repair = airshipPart["RepairMaterials"];
                }
            }
        }

        void BuildCompanyCraftDrafts()
        {
            foreach (var sCompanyCraftDraft in _builder.Sheet<Saint.CompanyCraftDraft>())
            {
                var name = sCompanyCraftDraft.Name.ToString();
                if (string.IsNullOrEmpty(name))
                    continue;

                var draft = _builder.CreateItem("draft" + sCompanyCraftDraft.Key);
                _builder.Localize.Strings((JObject)draft, sCompanyCraftDraft, Utils.CapitalizeWords, "Name");
                draft.en.description = "Unlocks company recipes for " + sCompanyCraftDraft.CompanyCraftDraftCategory.Name.ToString() + ".";
                draft.ilvl = 1;
                draft.category = -2;
                draft.icon = "custom/draft";

                // Setup unlocks as a recipe.
                dynamic recipe = new JObject();
                recipe.id = "draft" + sCompanyCraftDraft.Key;
                recipe.job = 0;
                recipe.rlvl = 1;
                recipe.lvl = 1;
                recipe.fc = 1;

                recipe.ingredients = new JArray();
                foreach (var sRequiredItem in sCompanyCraftDraft.RequiredItems)
                {
                    var ingredient = new IngredientModel(sRequiredItem.Item, sRequiredItem.Count, null, 0);
                    recipe.ingredients.Add(ConvertIngredient(ingredient, draft));
                }
                draft.craft = new JArray(recipe);

                // Record unlocks.
                draft.unlocks = new JArray();
                foreach (var sUnlockedSequence in sCompanyCraftDraft.UnlockedSequences)
                {
                    if (sUnlockedSequence.ResultItem.Key == 0)
                        continue;

                    var unlockedItem = _builder.Db.ItemsById[sUnlockedSequence.ResultItem.Key];
                    foreach (var innerRecipe in unlockedItem.craft)
                        innerRecipe.unlockId = draft.id;
                    draft.unlocks.Add(sUnlockedSequence.ResultItem.Key);
                    _builder.Db.AddReference(draft, "item", sUnlockedSequence.ResultItem.Key, false);
                    _builder.Db.AddReference(unlockedItem, "item", (string)draft.id, false);
                }
            }

            // Special category for the drafts.
            dynamic category = new JObject();
            category.id = -2;
            category.name = "Company Drafts";
            _builder.Db.ItemCategories.Add(category);
        }

        dynamic ConvertIngredient(IngredientModel ingredient, dynamic source)
        {
            var ingredientItem = _builder.Db.ItemsById[ingredient.Item.Key];
            if (ingredientItem.category != 59)
            {
                // Add reverse ingredient.
                JObject ingredient_of = ingredientItem.ingredient_of;
                if (ingredient_of == null)
                    ingredientItem.ingredient_of = ingredient_of = new JObject();

                string sourceId = source.id;
                if (!ingredient_of.TryGetValue(sourceId, out var existingValue))
                {
                    _builder.Db.AddReference(source, "item", ingredient.Item.Key, true);
                    _builder.Db.AddReference(ingredientItem, "item", sourceId, false);
                    ingredient_of.Add(sourceId, ingredient.Quantity);
                }
            }

            // Create the ingredient object for the source.
            dynamic result = new JObject();
            result.id = ingredient.Item.Key;
            result.amount = ingredient.Quantity;
            if (ingredient.StepId != null)
                result.stepid = ingredient.StepId;
            if (!string.IsNullOrEmpty(ingredient.Part))
                result.part = ingredient.Part;
            if (ingredient.Phase > 0)
                result.phase = ingredient.Phase;
            if (ingredient.QualityPerItem > 0 && ingredient.Item.CanBeHq)
                result.quality = ingredient.QualityPerItem;
            return result;
        }
    }
}
