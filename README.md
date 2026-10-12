# Tic Tac Toe

NumPy ile geliştirilen özgün Tic-Tac-Toe çalışmasının tarayıcıda oynanabilen sürümü.

Yapay zekâya ya da arkadaşına karşı seri maçlar oynanır:

- **Yapay zekâ rakip:** Çırak, Usta ve Efsane zorlukları. 3×3'te Efsane minimax ile
  kusursuz oynar; büyük tahtalarda tehdit ve fırsat analizi yapar.
- **Tahtalar:** 3×3 ve 4×4 tam sıra, 5×5 dörtlü, 6×6 beşli çizgi ister.
- **Seri maç:** tek tur, ilk 2'ye ya da ilk 3'e; ilk hamle her turda el değiştirir.
- **Hamle süresi:** isteğe bağlı 10 sn ya da 5 sn Blitz; süre biterse rastgele hamle yapılır.
- **Kontroller:** fare/dokunmatik ya da klavye (`← → ↑ ↓`, `Enter`, `U` geri al,
  `R` turu yenile, `M` ses, `Esc` duraklat).
- Rekorlar tarayıcıda saklanır; sesler Web Audio ile üretilir.

## Web sürümü

[Tic Tac Toe'yu tarayıcıda oyna](https://tic-tac-toe-game-delta-jade.vercel.app/)

Yerelde `index.html` dosyasını açarak da kurulum yapmadan oynayabilirsiniz.

## Özgün çalışma

- `TicTacToe.ipynb`: açıklamalı Colab/Jupyter defteri
- `TicTacToe.ipynb - Colab.pdf`: defterin PDF çıktısı

Web sürümü saf HTML, CSS ve JavaScript kullanır.
