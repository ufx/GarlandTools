<?php

require 'common.php';

gtMain();

function gtRead() {
    $account = $_POST["account"];
    $id = $_POST["id"];
    $modified = $_POST["modified"];
    
    $result = gtReadCore($account, $id, $modified);
    echo json_encode($result);
}

function gtReadCore($account, $id, $modified) {
    $db = gtConnect();
    $select = gtExecute($db, "SELECT Value, Modified FROM Storage WHERE Account = ? AND Id = ? AND Modified > ?", "sss", $account, $id, $modified);

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
    $account = $_POST["account"];
    $id = $_POST["id"];
    $ip = gtIP();

    gtWriteCore($account, $id, $value, $ip, $modified);
    echo json_encode(array('modified' => $modified));
}

function gtWriteCore($account, $id, $value, $ip, $modified) {
    $db = gtConnect();
    gtExecute($db, "REPLACE INTO Storage VALUES (?, ?, ?, ?, ?)", "sssss", $account, $id, $ip, $modified, $value);
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
