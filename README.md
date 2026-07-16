# TV Monitor

Pagina estatica para Smart TV LG que rotaciona paginas de status configuradas em `sites.json`.

## Como configurar

Edite `sites.json`:

```json
{
  "sites": [
    {
      "name": "Servico A",
      "url": "https://status.exemplo.com/",
      "durationSeconds": 60
    },
    {
      "name": "Servico B",
      "url": "https://status2.exemplo.com/",
      "embed": false,
      "durationSeconds": 60
    }
  ]
}
```

`durationSeconds` e opcional. Se nao for informado, o tempo padrao e 60 segundos.
Use `"embed": false` quando o site bloquear exibicao dentro de `iframe`.

## Como executar

Sirva a pasta por HTTP e abra o endereco no navegador da TV:

```bash
python3 -m http.server 8080
```

Depois acesse:

```text
http://IP-DO-COMPUTADOR:8080
```

Abrir o arquivo `index.html` diretamente pode impedir o carregamento de `sites.json` em alguns navegadores.

## Observacao

Alguns sites bloqueiam exibicao dentro de `iframe` por configuracoes como `X-Frame-Options` ou `Content-Security-Policy`. Quando isso acontecer, a pagina precisa liberar embed ou ser monitorada por uma URL alternativa propria para TV.

## Audio silencioso para TV

O monitor ja inclui um MP3 silencioso curto em loop para tentar manter a TV com midia ativa:

```text
https://eduz.github.io/pagemon/assets/silent.mp3
```

Ele fica embutido na propria aplicacao:

```html
<audio autoplay loop id="keepAliveAudio">
  <source src="https://eduz.github.io/pagemon/assets/silent.mp3" type="audio/mpeg">
</audio>
```

Se o navegador da TV bloquear autoplay, tente iniciar a pagina uma vez com interacao do controle remoto.

## Publicar no GitHub Pages

1. Crie um repositorio vazio no GitHub.
2. Envie este projeto para a branch `main`.
3. No GitHub, acesse `Settings` > `Pages`.
4. Em `Build and deployment`, selecione `Deploy from a branch`.
5. Escolha `main` e a pasta `/root`.
6. Salve e aguarde o GitHub gerar a URL.
