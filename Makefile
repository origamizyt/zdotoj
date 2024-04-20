all: frontend backend
install:
	@echo "#! $$SHELL" >> run.sh
	@echo "$$PWD/dist/zdotoj" >> run.sh
	@mv run.sh /usr/local/bin/z.oj
	@chmod 777 /usr/local/bin/z.oj
frontend:
	@npm run build
backend:
	@cd gosrc && go install && go build -o ../dist/zdotoj zdotoj