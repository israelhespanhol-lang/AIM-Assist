# 🎮 GamepadEmulation v0.2.0

> Emulador de Controle Xbox 360 de **alta performance e ultrabaixa latência** a partir de Teclado e Mouse para Windows.

---

## ⚡ Principais Recursos e Melhorias

- **Zero-Lock Mouse Processing**: Amostragem direta na thread de controle, eliminando `Arc<Mutex>` intermediário e reduzindo latência a níveis sub-milissegundo (ideal para mouses de 1000Hz+).
- **Compensação de Anti-Deadzone**: Elimina a zona morta interna dos jogos de tiro (como CoD, Warzone, Apex, Halo), permitindo micro-ajustes precisos de mira com o mouse.
- **Curvas de Resposta Configuráveis**: Suporte a curva linear (`1.0`) ou curvas de aceleração exponencial (`1.2` a `1.6`) para controle fino em mira à distância.
- **Modo ADS (Aim Down Sight)**: Multiplicador automático de sensibilidade ao segurar o botão de mira (ex: Botão Direito do Mouse).
- **Sensibilidade Separada para Eixos X e Y**: Permite ajustar a proporção vertical/horizontal da tela.
- **Modo Alternativo / Paraquedas**: Alternância rápida de sensibilidade via tecla configurável (padrão `X`).
- **Loop com Tick Rate Configurável**: Padrão de 250Hz (4ms por frame de controle), mantendo uso de CPU próximo de **0%**.
- **Desconexão Limpa do Controle Virtual**: Desanexa o controle do barramento ViGEm automaticamente ao fechar o aplicativo.

---

## 📦 Pré-requisitos

1. **Driver ViGEmBus**: [Baixar ViGEmBus Driver](https://github.com/nefarius/ViGEmBus/releases) (Necessário para criar o controle virtual do Xbox 360).
2. **Driver Interception**: [Interception C Library / Driver](http://www.oblita.com/interception.html) (Necessário para captura e bloqueio de baixo nível de teclado e mouse).
3. **Rust & Cargo**: [Instalar Rust](https://rustup.rs/) (caso deseje compilar a partir do código-fonte).

---

## 🚀 Como Compilar e Executar

### Compilar em modo Release (Otimizado):
```bash
cargo build --release
```
O executável otimizado estará em `target/release/GamepadEmulation.exe`.

### Executar:
```bash
cargo run --release
```

### Argumentos de Linha de Comando:
```text
Opções:
  -s, --settings <CAMINHO>   Caminho para o arquivo de configurações (Padrão: Settings.ron)
  -c, --create-config        Gera um arquivo de configuração padrão Settings.ron e sai
  -h, --help                 Exibe ajuda
  -V, --version              Exibe a versão
```

---

## ⚙️ Configuração (`Settings.ron`)

O arquivo de configuração utiliza a sintaxe [RON (Rusty Object Notation)](https://github.com/ron-rs/ron):

```ron
(
    dispatcher: (
        toggle_key: Grave,            // Tecla para ligar/desligar a emulação (Padrão: ` / aspa)
        excluded_keys: [              // Teclas que passam direto para o Windows
            X, J, L, Z, LeftAlt, LeftShift, Tab
        ],
    ),
    aiming: (
        sensitivity: 1.0,             // Sensibilidade base da mira
        alt_sensitivity: 3.0,         // Sensibilidade do modo alternativo / paraquedas
        ads_multiplier: 0.75,         // Multiplicador ao mirar (ADS) (75% da sensibilidade base)
        yaw_multiplier: 1.0,          // Escala do eixo horizontal (X)
        pitch_multiplier: 1.0,        // Escala do eixo vertical (Y)
        invert_pitch: false,          // Inverter eixo Y (true / false)
        anti_deadzone: 0.10,          // Anti-Deadzone (0.10 = 10% para cancelar deadzone do jogo)
        curve_exponent: 1.0,          // 1.0 = Linear | 1.3 = Exponencial suave
        mouse_smoothing_level: 5,     // Janela de suavização em milissegundos
    ),
    controls: (
        alt_sensitivity_key: Some(X), // Tecla para alternar modo paraquedas/rápido
        ads_button: Some(Right),      // Botão do mouse para ativar sensibilidade ADS
        movement: (                   // Teclas de movimentação (alavanca esquerda)
            forward: W,
            backward: S,
            left: A,
            right: D,
        ),
    ),
    tick_rate_hz: 250,                // Taxa de atualização do controle em Hz
    binds: {
        Keyboard(Space): Button(A),
        Keyboard(C): Button(B),
        Keyboard(R): Button(X),
        Keyboard(E): Button(Y),
        Keyboard(LeftShift): Button(LeftThumb),
        Keyboard(V): Button(RightThumb),
        Keyboard(Q): Button(LeftShoulder),
        Keyboard(F): Button(RightShoulder),
        Mouse(Left): Button(RightTrigger),
        Mouse(Right): Button(LeftTrigger),
    },
)
```
