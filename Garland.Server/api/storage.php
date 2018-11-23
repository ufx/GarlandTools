<?php

require 'common.php';

gtMain();

function gtRead() {
    $id = $_POST["id"];
    $modified = $_POST["modified"];
    
    $result = gtReadCore($id, $modified);
    echo json_encode($result);
}

function gtReadCore($id, $modified) {
    $db = gtConnect();
    $select = gtExecute($db, "SELECT Value, Modified FROM Storage WHERE Id = ? AND Modified > ?", "ss", $id, $modified);

    $value = NULL;
    $newModified = NULL;
    $select->bind_result($value, $newModified);
    if ($select->fetch()) {
        $select->close();
        if ($value != NULL)
            return array('value' => $value, 'modified' => $newModified);
    }

    return NULL;
}

function gtWrite() {
    $value = $_POST["value"];
    if (strlen($value) > 100000)
        gtError("Value is too large.");

    $modified = date('Y-m-d H:i:s');
    $id = array_key_exists("id", $_POST) ? $_POST["id"] : gtRandomString(10);
    $ip = gtIP();

    gtWriteCore($id, $value, $ip, $modified);
    echo json_encode(array('id' => id, 'modified' => $modified));
}

function gtWriteCore($id, $value, $ip, $modified) {
    $db = gtConnect();
    gtExecute($db, "REPLACE INTO Storage VALUES (?, ?, ?, ?)", "ssss", $id, $value, $ip, $modified);
}

function gtMain() {
    $method = $_POST["method"];

    if ($method == "read")
        gtRead();
    else if ($method == "write")
        gtWrite();
    else
        gtError("Invalid list method.");
}

?>
