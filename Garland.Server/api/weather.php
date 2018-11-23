<?php

include 'weather.inc.php';

function calculateForecastTarget ($time) {
	// Thanks to Rogueadyn's SaintCoinach library for this calculation.

	$unixSeconds = floor($time);
        // Get Eorzea hour for weather start
        $bell = $unixSeconds / 175;

        // Do the magic 'cause for calculations 16:00 is 0, 00:00 is 8 and 08:00 is 16
        $increment = ($bell + 8 - ($bell % 8)) % 24;

        // Take Eorzea days since unix epoch
        $totalDays = floor($unixSeconds / 4200);

        // 0x64 = 100
        $calcBase = $totalDays * 100 + $increment;

        // 0xB = 11
        $step1 = (($calcBase << 11) & 0xFFFFFFFF) ^ $calcBase;
        $step2 = ($step1 >> 8) ^ $step1;

        // 0x64 = 100
        return $step2 % 100;
}

// Calculate forecasts
$time = time();
$forecasts = array();
for ($i = 0; $i < 10; $i++) {
	$current = $time + ($i * 23 * 60);
	array_push($forecasts, calculateForecastTarget($current));
}

// Package the weather for these forecasts.

$results = array();
foreach ($zoneWeather as $zone => $rates) {
	$weather = array();
	foreach ($forecasts as $forecast) {
		foreach ($rates as $rate) {
			if ($forecast < $rate['Rate']) {
				array_push($weather, $weatherIndex[$rate['Weather']]);
				break;
			}
		}
	}
	$results[$zone] = $weather;
}

header("Content-Type: application/json; charset=utf-8");
echo json_encode($results);

?>
