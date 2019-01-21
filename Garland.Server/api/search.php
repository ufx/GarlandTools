<?php

require 'common.php';

function gtSearch() {
    header("Content-Type: application/json; charset=utf-8");

    $text = array_key_exists("text", $_GET) ? $_GET["text"] : "";
    $lang = gtValidateSearchLang(array_key_exists("lang", $_GET) ? $_GET["lang"] : "en");
    $type = array_key_exists("type", $_GET) ? $_GET["type"] : NULL;
    $offset = array_key_exists("page", $_GET) ? $_GET["page"] * 50 : 0;
    $debug = array_key_exists("udebug", $_GET) ? true : false;
    $exact = array_key_exists("exact", $_GET) ? true : false;

    $result = gtSearchCore($text, $lang, $type, $_GET, $offset, $debug, $exact);
    echo json_encode($result);
}

function gtSearchCore($text, $lang, $type, $filters, $offset, $debug, $exact) {
    // Generate SQL.
    $db = gtConnect();
    $sql = gtSearchSql($db, $text, $lang, $type, $filters, $offset, $exact);

    // Return SQL for debug.
    if ($debug)
        return array("sql" => $sql);

    // Execute the search.
    $cmd = $db->prepare($sql);
    if ($cmd == null)
        gtError("Invalid search command.");

    $cmd->execute();
    if ($cmd->errno)
        gtError($cmd->error);

    // Fetch results.
    $results = array();
    $type = NULL;
    $id = NULL;
    $json = NULL;
    $cmd->bind_result($type, $id, $json);
    while ($cmd->fetch()) {
        $result = array("type" => $type, "id" => $id, "obj" => json_decode($json));
        array_push($results, $result);
    }

    return $results;
}

function gtSanitizeSearchText($text) {
    return trim(preg_replace('/[^\p{L}\p{N}_ ]+/u', '', $text));
}

function gtValidateSearchLang($lang) {
    if ($lang == "en" || $lang == "fr" || $lang == "de" || $lang == "ja")
        return $lang;
    return "en";
}

function gtSearchSql($db, $text, $lang, $type, $filters, $offset, $exact) {
    // Parameters and extra criteria.
    $filterCriteria = "";
    $filterJoin = "";

    // Filter by type.
    if ($type) {
        $type = $db->real_escape_string($type);
        $filterCriteria .= " AND Search.Type = '$type'";
    }

    // Item filters.
    $hasItemFilters = false;

    if (array_key_exists("ilvlMin", $filters)) {
        $ilvlMin = (int)$filters["ilvlMin"];
        $filterCriteria .= " AND SearchItem.ItemLevel >= $ilvlMin";
        $hasItemFilters = true;
    }
    if (array_key_exists("ilvlMax", $filters)) {
        $ilvlMax = (int)$filters["ilvlMax"];
        $filterCriteria .= " AND SearchItem.ItemLevel <= $ilvlMax";
        $hasItemFilters = true;
    }
    if (array_key_exists("elvlMin", $filters)) {
        $elvlMin = (int)$filters["elvlMin"];
        $filterCriteria .= " AND SearchItem.EquipLevel >= $elvlMin";
        $hasItemFilters = true;
    }
    if (array_key_exists("elvlMax", $filters)) {
        $elvlMax = (int)$filters["elvlMax"];
        $filterCriteria .= " AND SearchItem.EquipLevel <= $elvlMax AND SearchItem.EquipLevel != 0";
        $hasItemFilters = true;
    }
    if (array_key_exists("pvp", $filters)) {
        $filterCriteria .= " AND SearchItem.IsPvP = b'1'";
        $hasItemFilters = true;
    }
    if (array_key_exists("craftable", $filters)) {
        $filterCriteria .= " AND SearchItem.IsCraftable = b'1'";
        $hasItemFilters = true;
    }
    if (array_key_exists("desynthable", $filters)) {
        $filterCriteria .= " AND SearchItem.IsDesynthable = b'1'";
        $hasItemFilters = true;
    }
    if (array_key_exists("collectable", $filters)) {
        $filterCriteria .= " AND SearchItem.IsCollectable = b'1'";
        $hasItemFilters = true;
    }
    if (array_key_exists("rarity", $filters)) {
        $rarity = (int)$filters["rarity"];
        $filterCriteria .= " AND SearchItem.Rarity = $rarity";
        $hasItemFilters = true;
    }
    if (array_key_exists("itemCategory", $filters)) {
        $itemCategory = (int)$filters["itemCategory"];
        $filterCriteria .= " AND SearchItem.Category = $itemCategory";
        $hasItemFilters = true;
    }
    if (array_key_exists("itemCategories", $filters)) {
        $itemCategories = gtNumericStringArray($filters["itemCategories"]);
        $filterCriteria .= " AND SearchItem.Category IN ($itemCategories)";
        $hasItemFilters = true;
    }
    if (array_key_exists("jobCategories", $filters)) {
        $jobCategories = gtNumericStringArray($filters["jobCategories"]);
        $filterCriteria .= " AND SearchItem.Jobs IN ($jobCategories)";
        $hasItemFilters = true;
    }
    if (array_key_exists("clvlMin", $filters)) {
        $clvlMin = (int)$filters["clvlMin"];
        $filterCriteria .= " AND Search.Id IN (SELECT ItemId FROM SearchRecipe WHERE JobLevel >= $clvlMin)";
    }
    if (array_key_exists("clvlMax", $filters)) {
        $clvlMax = (int)$filters["clvlMax"];
        $filterCriteria .= " AND Search.Id IN (SELECT ItemId FROM SearchRecipe WHERE JobLevel <= $clvlMax)";
    }
    if (array_key_exists("craftJob", $filters)) {
        $craftJob = (int)$filters["craftJob"];
        $filterCriteria .= " AND Search.Id IN (SELECT ItemId FROM SearchRecipe WHERE Job = $craftJob)";
    }
    if ($exact) {
        $text = $db->real_escape_string($text);
        $filterCriteria .= " AND Search.OriginalName = '$text'";
    }

    if ($hasItemFilters)
        $filterJoin .= " JOIN SearchItem ON SearchItem.Id = Search.Id AND Search.Type = 'item'";

    // Text filters
    if ($text && !$exact) {
        $text = $db->real_escape_string(gtSanitizeSearchText($text));

        // Prioritize text that starts a key.
        $sql = "SELECT Type, Id, Json FROM (SELECT * FROM ((SELECT 2 AS Rank, Search.Type, Search.Id, Search.Name, Search.Json FROM Search $filterJoin WHERE Search.Lang = '$lang' AND Search.Name LIKE '{$text}%' $filterCriteria)";

        // Now use the full text index to pull back matches.
        $words = explode(" ", $text);
        foreach ($words as $key => $value)
            $words[$key] = "+{$value}*";
        $wordCriteria = join(" ", $words);

        $sql .= " UNION (SELECT 1 AS Rank, Search.Type, Search.Id, Search.Name, Search.Json FROM Search $filterJoin WHERE Search.Lang = '$lang' AND MATCH(Search.Name) AGAINST('$wordCriteria' IN BOOLEAN MODE) $filterCriteria)";

        $sql .= ") UnorderedResults) Results GROUP BY Type, Id, Json, Name ORDER BY MAX(Rank) DESC, Name LIMIT 50 OFFSET $offset";
        return $sql;
    } else {
        return "SELECT Search.Type, Search.Id, Search.Json FROM Search $filterJoin WHERE Search.Lang = '$lang' $filterCriteria ORDER BY Search.Name LIMIT 50 OFFSET $offset";
    }
}

gtSearch();

?>
