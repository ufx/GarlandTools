import json
import traceback
import requests
import bs4

from tqdm import tqdm

# config this!
# if true:
# it will use the local dungeon list generated last time
# else it will regenerate a duty list.
LOAD_LOCAL = True

user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 " \
             "Safari/537.36 "

header = {
    "User-Agent": user_agent,
    "Referer": "https://na.finalfantasyxiv.com/lodestone/playguide/db/duty/"
}

host = "https://na.finalfantasyxiv.com"
url_base = "https://na.finalfantasyxiv.com/lodestone/playguide/db/duty/?category2="
url_dungeon = url_base + "2"
url_guildhests = url_base + "3"
url_trials = url_base + "4"
url_raids = url_base + "5"
url_pvp = url_base + "6"
url_ultimate = url_base + "28"

fails = []


def extract_treasure_box(div_box):
    box = {}

    a_box = div_box.find(name="a", attrs={"class": "sys_treasure_box_toggle"})
    box["name"] = a_box.get_text().strip()

    div_inner = div_box.find(name="div", attrs={"class": "db-view__treasure_box_popup__inner"})

    div_coord = div_inner.find(name="div", attrs={"class": "db-view__treasure_box_popup__map_coordinates"})
    if div_coord:
        box["coord"] = div_coord.get_text().strip()

    div_item = div_inner.find(name="div", attrs={"class": "db-view__treasure_box_popup__treasure_items"})
    if div_item:
        items = []
        for item in div_inner.find_all(name="div",
                                       attrs={"class": "db-view__treasure_box_popup__treasure_items__box--text"}):
            if not isinstance(item, bs4.Tag):
                continue
            a_item = item.find(name="a")
            if a_item:
                items.append(a_item.get_text().strip())
            else:
                items.append(item.get_text().strip())
        box["items"] = items
    else:
        print("Empty box???")

    return box


def crawl_single_duty(duty):
    try:
        req_duty = requests.get(host + duty["url"], headers=header)
    except Exception:
        fails.append(duty)
        return

    root_duty = bs4.BeautifulSoup(req_duty.text, "lxml")

    fights = []
    chests = []
    for div in root_duty.find_all(name="div", attrs={"class": "db-view__data__inner__wrapper"}):
        fight = {}

        # ignore \n
        if not isinstance(div, bs4.Tag):
            continue

        # jump over strange things
        if "class" not in div.attrs.keys():
            continue

        h3_title = div.find(name="h3")
        class_title = str(h3_title.attrs["class"])
        if "silver" in class_title:
            fight["chest"] = "silver"

        if "gold" in class_title:
            fight["chest"] = "gold"
        title = h3_title.get_text().strip()

        # Strip boss fights and chests after the fight
        if "Boss" in title:
            fight["boss"] = []
            boss_list = div.find_all(name="li", attrs={"class": "boss"})
            for li_boss in boss_list:
                if not isinstance(li_boss, bs4.Tag):
                    continue
                boss = {}
                a_boss = li_boss.find(name="a")
                boss["url"] = a_boss.attrs["href"]
                boss["name"] = a_boss.find(name="strong").get_text().strip()
                fight["boss"].append(boss)

            drop_items = []
            treasures = []
            tokens = []
            for boss_div in div.children:
                if not isinstance(boss_div, bs4.Tag):
                    continue

                if "class" not in boss_div.attrs.keys():
                    continue

                if "db-view__data__reward" not in str(boss_div.attrs["class"]):
                    continue

                if "item" in str(boss_div.attrs["class"]):
                    # Process item
                    item = {}
                    div_item = boss_div.find(name="div", attrs={"class": "db-view__data__reward__item__name"})
                    try:
                        a_item = div_item.find(name="a")
                        item["name"] = a_item.get_text().strip()
                        item["url"] = a_item.attrs["href"]

                        condition = a_item.parent.find(name="div",
                                                       attrs={"class": "db-view__data__reward__item__condition"})
                        if condition:
                            item["condition"] = []
                            for con in condition.children:
                                if isinstance(con, bs4.Tag):
                                    item["condition"].append(con.get_text())
                    except AttributeError:
                        item["name"] = div_item.get_text().strip()

                    drop_items.append(item)

                if "treasure" in str(boss_div.contents[1].attrs["class"]):
                    # Process treasure box
                    treasures.append(extract_treasure_box(boss_div))

                if "token" in str(boss_div.contents[1].attrs["class"]):
                    # Process token
                    for div_token in boss_div.children:
                        if not isinstance(div_token, bs4.Tag):
                            continue
                        token = {"name": div_token.find(name="div",
                                        attrs={"class": "db-view__data__reward__token--name"}).get_text().strip(),
                                 "amount": div_token.find(name="div",
                                          attrs={"class": "db-view__data__reward__token--value"}).get_text().strip()}
                        tokens.append(token)

            if len(drop_items) >= 1:
                fight["drops"] = drop_items

            if len(treasures) >= 1:
                fight["treasures"] = treasures

            if len(tokens) >= 1:
                fight["token"] = tokens

        # Strip other rewards
        elif "Other Rewards" in title:
            wrapper = h3_title.parent
            for box in wrapper.children:
                if not isinstance(box, bs4.Tag):
                    continue
                if box.name != "div":
                    continue
                chests.append(extract_treasure_box(box))

        if len(fight) >= 1:
            fights.append(fight)

    if len(chests) >= 1:
        duty["chests"] = chests
    if len(fights) >= 1:
        duty["fights"] = fights

    return duty


def crawl_instance(instances, url, category, pages=1):
    attrs = {"class": "db-table"}
    i = 1
    while i <= pages:
        req_dungeon = requests.get(url + "&page=" + str(i), headers=header)

        root_dungeon = bs4.BeautifulSoup(req_dungeon.text, "lxml")

        table = root_dungeon.find(name="table", attrs=attrs)

        tbody = table.find(name="tbody")
        for tr in tbody.find_all(name="tr"):
            try:
                instance = {}
                tds = tr.find_all(name="td")
                td_name = tds[0]
                a_version = td_name.find(name="a")
                a_name = td_name.find(attrs={"class": "db_popup db-table__txt--detail_link"})

                td_lvl = tds[1]
                td_ilvl = tds[2]

                instance["category"] = category
                instance["version"] = a_version.get_text().strip()
                instance["name"] = a_name.get_text().strip()
                instance["url"] = a_name.attrs["href"]
                instance["lvl"] = td_lvl.get_text().strip()
                instance["ilvl"] = td_ilvl.get_text().strip()

                instances.append(instance)
            except Exception:
                traceback.print_exc()
        i += 1


def crawl_duty_start(load_local):
    duties = []

    if load_local:
        duties = json.load(open("Duties.json"))
    else:
        crawl_instance(duties, url_guildhests, "guildhest")
        crawl_instance(duties, url_dungeon, "dungeon", pages=2)
        crawl_instance(duties, url_trials, "trial", pages=2)
        crawl_instance(duties, url_raids, "raid", pages=3)
        crawl_instance(duties, url_ultimate, "ultimate")
        # crawl_instance(duties, url_pvp, "pvp")

        with open('Duties.json', "w+") as file:
            file.write(json.dumps(duties, indent=4))

    for duty in tqdm(duties):
        if duty["category"] == "guildhest":
            continue
        crawl_single_duty(duty)

    for duty in tqdm(fails):
        crawl_single_duty(duty)

    with open('FFXIV Data - Duties.json', "w+") as file:
        file.write(json.dumps(duties, indent=4))

    with open('fails.json', "w+") as file:
        file.write(json.dumps(fails, indent=4))


if __name__ == '__main__':
    crawl_duty_start(LOAD_LOCAL)
