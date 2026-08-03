#!/usr/bin/env python3
import json
import time
import urllib.request
from datetime import datetime, timezone


SOURCE_URL = "https://health.aws.amazon.com/public/currentevents"
REGIONS = [
    {"code": "sa-east-1", "label": "Sao Paulo"},
    {"code": "us-east-1", "label": "N. Virginia"},
]


def event_matches_region(event, region):
    arn = str(event.get("arn", ""))
    service = str(event.get("service", ""))
    service_status = event.get("service_status") or []

    return (
        (":health:" + region + ":") in arn
        or ("-" + region) in service
        or any(("-" + region) in str(item.get("service", "")) for item in service_status)
    )


def event_state(event):
    status = int(event.get("status") or event.get("current_status") or 0)

    if status >= 3:
        return "bad"
    if status >= 1:
        return "warn"
    return "ok"


def summarize_region(events, region):
    matches = [event for event in events if event_matches_region(event, region["code"])]
    state = "ok"
    title = "Operational"
    detail = region["label"]

    for event in matches:
        current_state = event_state(event)
        if current_state == "bad":
            state = "bad"
        elif current_state == "warn" and state != "bad":
            state = "warn"

    if matches:
        title = f"{len(matches)} evento(s)"
        detail = matches[0].get("summary") or matches[0].get("service_name") or region["label"]

    return {
        "code": region["code"],
        "label": region["label"],
        "state": state,
        "title": title,
        "detail": detail,
    }


def main():
    with urllib.request.urlopen(SOURCE_URL, timeout=20) as response:
        raw = response.read()

    try:
        text = raw.decode("utf-16")
    except UnicodeError:
        text = raw.decode("utf-8")

    events = json.loads(text)
    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_URL,
        "regions": [summarize_region(events, region) for region in REGIONS],
    }

    with open("aws-regions.json", "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=True, indent=2)
        output.write("\n")


if __name__ == "__main__":
    main()
