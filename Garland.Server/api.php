<?php

require 'api/common.php';

gtMain();

//
// Garland Data list API
// todo: deprecated, remove when hits subside.  Moved to api/list.php.
//

function gtListShare() {
    $name = $_POST["name"];
    if (strlen($name) < 5)
        gtError("List name must be at least 5 characters long.");

    $list = $_POST["list"];
    if (strlen($list) > 10000)
        gtError("List too large.");

    $id = gtRandomString(10);
    $shared = date('Y-m-d H:i:s');
    $ip = gtIP();

    $id = gtListShareCore($id, $name, $list, $ip, $shared);
    echo json_encode(array('id' => $id));
}

function gtListShareCore($id, $name, $list, $ip, $shared) {
    $salt = "qajexcu1GuwiQojkIOmJ";
    $hash = sha1($list . $salt);
    $db = gtConnect();

    // Check for an existing list sharing this hash.
    $select = gtExecute($db, "SELECT Id FROM Lists WHERE Hash = ?", "s", $hash);

    // Return this list ID if the hash exists.
    $existingId = NULL;
    $select->bind_result($existingId);
    if ($select->fetch())
        return $existingId;
    $select->close();

    // Insert the list.
    gtExecute($db, "INSERT INTO Lists (Id, Name, Hash, IP, Shared, List) VALUES(?, ?, ?, ?, ?, ?)", "ssssss", $id, $name, $hash, $ip, $shared, $list);

    return $id;
}

function gtListRead() {
    $id = $_POST["id"];

    $result = gtListReadCore($id);
    echo json_encode($result); 
}

function gtListReadCore($id) {
    $db = gtConnect();
    $read = gtExecute($db, "SELECT Name, List FROM Lists WHERE Id = ?", "s", $id);

    $name = NULL;
    $list = NULL;
    $read->bind_result($name, $list);
    if ($read->fetch()) {
        $result = array('name' => $name, 'list' => $list);

        $read->close();

        gtExecute($db, "UPDATE Lists SET Uses = Uses + 1 WHERE Id = ?", "s", $id);
        return $result;
    }
    else
        gtError("List not found.");
}

//
// Dispatch
//

function gtMain() {
    $method = $_POST["method"];

    if ($method == "list-read")
        gtListRead();
    else if ($method == "list-share")
        gtListShare();
    else if ($method == "kv-write")
        gtKeyValueWrite();
    else if ($method == "kv-read")
        gtKeyValueRead();
    else
        gtError("Invalid method.");
}

?>
