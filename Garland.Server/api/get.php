<?php

require 'common.php';

function gtGet() {
    $id = $_GET["id"];
    $type = $_GET["type"];
    $version = $_GET["version"];
    $lang = array_key_exists("lang", $_GET) ? $_GET["lang"] : 'xx';
    $test = array_key_exists("test", $_GET) ? $_GET["test"] : 0;

    $ids = explode(",", $id);
    $idCount = count($ids);
    $result = NULL;
    if ($idCount == 1)
        $result = gtGetCore($id, $type, $lang, $version, $test);
    else if ($idCount < 20)
        $result = gtMultiGetCore($ids, $type, $lang, $version);
    else {
        // No more than 20 ids can be retrieved at a time.
        http_response_code(403);
        echo "Attempt to query too many ids.";
        exit(-1);
    }

    header("Content-Type: application/json; charset=utf-8");
    echo $result;
}

function gtGetCore($id, $type, $lang, $version, $test) {
    $table = $test ? "DataJsonTest" : "DataJson";

    $db = gtConnect();
    $select = gtExecute($db, "SELECT Json FROM $table WHERE Id = ? AND Type = ? AND Lang = ? AND Version = ?", "sssi", $id, $type, $lang, $version);

    $json = NULL;
    $select->bind_result($json);
    if ($select->fetch()) {
        $select->close();
        return $json;
    }
    else if ($test) {
        // Fallback to primary table if test table fails.
        return gtGetCore($id, $type, $lang, $version, 0);
    }

    // Not found.
    http_response_code(404);
    echo "404 not found.";
    exit(-1);
}

function gtMultiGetCore($ids, $type, $lang, $version) {
    // Prepare the query.
    $db = gtConnect();
    $select = $db->prepare("SELECT Id, Json from DataJson WHERE Id = ? AND Type = ? AND Lang = ? AND Version = ?");
    
    // MySQL doesn't use its indexes with WHERE Id IN (...).  It's faster to
    // execute the same query multiple times.
    $results = array();
    $id = NULL;
    $json = NULL;
    $select->bind_result($id, $json);

    foreach ($ids as $key => $value) {
        $select->bind_param("sssi", $value, $type, $lang, $version);
        $select->execute();
        if ($select->errno)
            gtError($select->error);

        if ($select->fetch())
            array_push($results, array("id" => $id, "obj" => json_decode($json)));
        else
            array_push($results, array("id" => $id, "error" => "not found"));
    }

    return json_encode($results);
}

gtGet();

?>
