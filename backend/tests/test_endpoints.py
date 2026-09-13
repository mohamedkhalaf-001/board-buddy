"""Endpoint tests for the Board Buddy API (see _docs/openapi.yaml)."""


def col_names(body):
    return [c["name"] for c in body["columns"]]


def post(client, cmd_type, payload):
    return client.post("/api/commands", json={"type": cmd_type, "payload": payload})


class TestBoardEndpoint:
    def test_get_board_shape_and_seed(self, client):
        r = client.get("/api/board")
        assert r.status_code == 200
        body = r.json()
        for key in ("columns", "swimlanes", "labels", "cards"):
            assert key in body
            assert isinstance(body[key], list)
        assert "Backlog" in col_names(body)
        assert body["swimlanes"]
        assert body["labels"]
        assert body["cards"]

    def test_board_is_stable_across_reads(self, client):
        first = client.get("/api/board").json()
        second = client.get("/api/board").json()
        assert first == second


class TestCommandsEndpoint:
    def test_create_column_returns_board_and_command_id(self, client):
        r = post(client, "create_column", {"name": "QA"})
        assert r.status_code == 200
        body = r.json()
        assert set(body) == {"board", "commandId"}
        assert "QA" in col_names(body["board"])
        assert body["commandId"]

    def test_unknown_command_type_is_400(self, client):
        r = post(client, "explode_the_board", {})
        assert r.status_code == 400
        assert "detail" in r.json()

    def test_invalid_payload_is_400(self, client):
        r = post(client, "create_column", {})
        assert r.status_code == 400

    def test_num_data_columns(self, client):
        board = client.get("/api/board").json()
        r = client.post(
            "/api/commands",
            json={
                "type": "move_card",
                "payload": {
                    "id": board["cards"][0]["id"],
                    "columnId": board["columns"][1]["id"],
                    "swimlaneId": board["cards"][0]["swimlaneId"],
                    "toIndex": 0,
                },
            },
        )
        assert r.status_code == 200

    def test_command_listing_excludes_snapshots(self, client):
        post(client, "create_column", {"name": "QA"})
        r = client.get("/api/commands")
        assert r.status_code == 200
        cmds = r.json()
        assert len(cmds) == 1
        entry = cmds[0]
        assert entry["type"] == "create_column"
        assert entry["undoApplied"] is False
        assert {"id", "type", "payload", "appliedAt", "undoApplied"} <= set(entry)
        assert "before" not in entry
        assert "after" not in entry

    def test_create_card(self, client):
        board = client.get("/api/board").json()
        col = board["columns"][0]["id"]
        lane = board["swimlanes"][0]["id"]
        r = post(
            client,
            "create_card",
            {
                "title": "Do the thing",
                "columnId": col,
                "swimlaneId": lane,
                "dueDate": "2026-09-20",
                "labelIds": [board["labels"][0]["id"]],
            },
        )
        assert r.status_code == 200
        cards = r.json()["board"]["cards"]
        card = next(c for c in cards if c["title"] == "Do the thing")
        assert card["columnId"] == col
        assert card["swimlaneId"] == lane
        assert card["dueDate"] == "2026-09-20"
        assert card["labelIds"] == [board["labels"][0]["id"]]
        assert card["position"] == 0
        assert card["createdAt"] == card["updatedAt"]

    def test_move_card_across_columns(self, client):
        board = client.get("/api/board").json()
        col_from, col_to = board["columns"][0], board["columns"][1]
        lane = board["swimlanes"][0]["id"]
        card = post(
            client,
            "create_card",
            {"title": "Move me", "columnId": col_from["id"], "swimlaneId": lane},
        ).json()["board"]["cards"][-1]
        r = post(
            client,
            "move_card",
            {
                "id": card["id"],
                "columnId": col_to["id"],
                "swimlaneId": lane,
                "toIndex": 0,
            },
        )
        assert r.status_code == 200
        moved = next(c for c in r.json()["board"]["cards"] if c["id"] == card["id"])
        assert moved["columnId"] == col_to["id"]
        assert moved["position"] == 0

    def test_update_card_bumps_updated_at(self, client):
        board = client.get("/api/board").json()
        card = board["cards"][0]
        r = post(
            client, "update_card", {"id": card["id"], "changes": {"title": "Tweaked"}}
        )
        assert r.status_code == 200
        updated = next(c for c in r.json()["board"]["cards"] if c["id"] == card["id"])
        assert updated["title"] == "Tweaked"
        assert updated["updatedAt"] != card["updatedAt"]

    def test_delete_column_removes_its_cards(self, client):
        board = client.get("/api/board").json()
        col = board["columns"][0]
        lane = board["swimlanes"][0]["id"]
        post(
            client,
            "create_card",
            {"title": "Will be deleted", "columnId": col["id"], "swimlaneId": lane},
        )
        r = post(client, "delete_column", {"id": col["id"]})
        assert r.status_code == 200
        cards = r.json()["board"]["cards"]
        assert all(c["columnId"] != col["id"] for c in cards)

    def test_delete_label_strips_from_cards(self, client):
        board = client.get("/api/board").json()
        label = board["labels"][0]
        card_id = board["cards"][0]["id"]
        post(client, "assign_label", {"cardId": card_id, "labelId": label["id"]})
        before = client.get("/api/board").json()
        assert (
            label["id"]
            in next(c for c in before["cards"] if c["id"] == card_id)["labelIds"]
        )
        r = post(client, "delete_label", {"id": label["id"]})
        assert r.status_code == 200
        after = r.json()["board"]
        assert (
            label["id"]
            not in next(c for c in after["cards"] if c["id"] == card_id)["labelIds"]
        )

    def test_set_wip_limit_null(self, client):
        board = client.get("/api/board").json()
        col_id = board["columns"][0]["id"]
        r = post(client, "set_wip_limit", {"id": col_id, "wipLimit": None})
        assert r.status_code == 200
        col = next(c for c in r.json()["board"]["columns"] if c["id"] == col_id)
        assert col["wipLimit"] is None

    def test_assign_remove_label(self, client):
        board = client.get("/api/board").json()
        label = board["labels"][0]
        card_id = board["cards"][0]["id"]
        add = post(client, "assign_label", {"cardId": card_id, "labelId": label["id"]})
        assert add.status_code == 200
        assert (
            label["id"]
            in next(c for c in add.json()["board"]["cards"] if c["id"] == card_id)[
                "labelIds"
            ]
        )
        remove = post(
            client, "remove_label", {"cardId": card_id, "labelId": label["id"]}
        )
        assert remove.status_code == 200
        assert (
            label["id"]
            not in next(
                c for c in remove.json()["board"]["cards"] if c["id"] == card_id
            )["labelIds"]
        )

    def test_missing_payload_key_is_400_for_matching_type(self, client):
        # rename_column requires {id, name}; id missing -> invalid payload
        r = post(client, "rename_column", {"name": "X"})
        assert r.status_code == 400


class TestUndoRedo:
    def test_undo_restores_previous_state_and_marks_command(self, client):
        before = client.get("/api/board").json()
        command_id = post(client, "create_column", {"name": "QA"}).json()["commandId"]
        assert "QA" in col_names(client.get("/api/board").json())
        r = client.post("/api/commands/undo")
        assert r.status_code == 200
        assert col_names(r.json()) == col_names(before)
        entry = next(
            c for c in client.get("/api/commands").json() if c["id"] == command_id
        )
        assert entry["undoApplied"] is True

    def test_undo_nothing_is_409(self, client):
        r = client.post("/api/commands/undo")
        assert r.status_code == 409

    def test_redo_reapplies_undone_command(self, client):
        post(client, "create_column", {"name": "QA"})
        client.post("/api/commands/undo")
        assert "QA" not in col_names(client.get("/api/board").json())
        r = client.post("/api/commands/redo")
        assert r.status_code == 200
        assert "QA" in col_names(r.json())

    def test_redo_nothing_is_409(self, client):
        post(client, "create_column", {"name": "QA"})
        r = client.post("/api/commands/redo")
        assert r.status_code == 409

    def test_undo_redo_roundtrip(self, client):
        before = client.get("/api/board").json()
        post(client, "create_column", {"name": "QA"})
        post(client, "create_column", {"name": "ZZZ"})
        client.post("/api/commands/undo")
        client.post("/api/commands/redo")
        after = client.get("/api/board").json()
        assert "QA" in col_names(after)
        assert "ZZZ" in col_names(after)
        assert [*col_names(before), "QA", "ZZZ"] == col_names(after)

    def test_new_command_after_undo_discards_redo_stack(self, client):
        post(client, "create_column", {"name": "QA"})
        client.post("/api/commands/undo")
        post(client, "create_column", {"name": "ZZZ"})
        redo = client.post("/api/commands/redo")
        assert redo.status_code == 409
        cmds = client.get("/api/commands").json()
        # the undone "QA" command was dropped from the redo stack on new input
        assert [c["type"] for c in cmds] == ["create_column"]
        assert all(c["undoApplied"] is False for c in cmds)
        assert all(c["payload"]["name"] != "QA" for c in cmds)


class TestActivityEndpoint:
    def test_logs_mutations_newest_first(self, client):
        post(client, "create_column", {"name": "QA"})
        post(client, "create_column", {"name": "ZZZ"})
        r = client.get("/api/activity")
        assert r.status_code == 200
        entries = r.json()
        assert entries[0]["summary"] == 'Column "ZZZ" created'
        assert entries[1]["summary"] == 'Column "QA" created'

    def test_respects_limit(self, client):
        for i in range(5):
            post(client, "create_column", {"name": f"C{i}"})
        # 5 mutations + the seeded "board created" entry
        assert len(client.get("/api/activity").json()) == 6
        assert len(client.get("/api/activity", params={"limit": 2}).json()) == 2

    def test_undo_is_logged(self, client):
        post(client, "create_column", {"name": "QA"})
        client.post("/api/commands/undo")
        entries = client.get("/api/activity").json()
        assert entries[0]["action"] == "undo"

    def test_activity_entry_shape(self, client):
        post(client, "create_column", {"name": "QA"})
        entry = client.get("/api/activity").json()[0]
        assert {
            "id",
            "action",
            "entityType",
            "entityId",
            "summary",
            "createdAt",
        } <= set(entry)
        assert entry["entityType"] == "column"


class TestResetEndpoint:
    def test_reset_restores_seed_and_clears_logs(self, client):
        post(client, "create_column", {"name": "QA"})
        client.post("/api/commands/undo")
        r = client.post("/api/reset")
        assert r.status_code == 200
        body = r.json()
        assert "Backlog" in col_names(body)
        assert "QA" not in col_names(body)
        assert client.get("/api/commands").json() == []
        assert (
            client.get("/api/activity").json()[0]["summary"].startswith("Board created")
        )
