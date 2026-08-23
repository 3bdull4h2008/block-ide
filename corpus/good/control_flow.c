int fib(int n) {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

int main(void) {
    for (int i = 0; i < 10; i++) {
        if (i % 3 == 0) {
            continue;
        } else {
            while (i > 7) {
                break;
            }
        }
        fib(i);
    }
    return 0;
}
