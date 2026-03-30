# oceanheart.ai — Hugo build wrapper
# Standalone repo. Data files (slopodar.yaml, decisions.json) are committed directly.

HUGO := hugo

.PHONY: build serve clean

build:
	$(HUGO)

serve:
	$(HUGO) server --bind 0.0.0.0 --port 1313

clean:
	rm -rf public resources
