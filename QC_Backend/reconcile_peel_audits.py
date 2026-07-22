import argparse
import json

from services.peel_audit_reconciliation_service import reconcile_pending_audits


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill pending Peel Strength values in saved IPQC audits")
    parser.add_argument("--source-record-id", help="Reconcile audits matching one newly-arrived Peel source record")
    parser.add_argument("--migrate-legacy-off-placeholders", action="store_true", help="Treat selected A/B sides containing twenty legacy OFF values as pending")
    parser.add_argument("--limit", type=int, default=500)
    args = parser.parse_args()
    print(json.dumps(reconcile_pending_audits(source_record_id=args.source_record_id, migrate_legacy=args.migrate_legacy_off_placeholders, limit=args.limit), indent=2))
