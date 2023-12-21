SHELL := /bin/bash

export APP_ROOT := $(shell pwd)

.DEFAULT_GOAL := help


-include $(APP_ROOT)/env/dev.overrides.mk

init:
	@docker-compose up -d --wait


dev:
	yarn dev