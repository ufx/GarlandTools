<?php

//
// Utility
//

function gtRandomString($length, $keyspace = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    $str = '';
    $max = strlen($keyspace) - 1;
    for ($i = 0; $i < $length; ++$i)
        $str .= $keyspace[random_int(0, $max)];
    return $str;
}

function gtNumericStringArray($input) {
    $parts = explode(",", $input);
    $results = array();
    foreach ($parts as $key => $value)
        $results[$key] = (int)$value;
    return join(",", $results);
}

function gtError($msg) {
    echo json_encode(array('error' => $msg));
    exit(-1);
}

function gtIP() {
    if ($_SERVER["HTTP_X_FORWARDED_FOR"])
        return $_SERVER["HTTP_X_FORWARDED_FOR"];

    return $_SERVER["REMOTE_ADDR"];
}

function gtConnect() {
    $db = new mysqli("localhost", $GLOBALS['gtDbUsername'], $GLOBALS['gtDbPassword'], $GLOBALS['gtDbName']);
    if ($db->connect_errno)
        exit("Failed to connect: (" . $db->connect_errno . ") " . $db->connect_error);

    if (!$db->set_charset("utf8"))
        exit("Failed to set db charset.");

    return $db;
}

function gtExecute($db, $sql, $types, ...$args) {
    // Build reference arguments list for reflection.
    $refArgs = array();
    foreach ($args as $key => $value)
        $refArgs[$key] = &$args[$key];
    array_unshift($refArgs, $types);

    $cmd = $db->prepare($sql);

    $class = new ReflectionClass('mysqli_stmt');
    $bindParam = $class->getMethod('bind_param');
    $bindParam->invokeArgs($cmd, $refArgs);

    $cmd->execute();
    if ($cmd->errno)
        gtError($cmd->error);
    return $cmd;
}

?>
