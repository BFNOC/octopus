package helper

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestGetURLDelayNilClient(t *testing.T) {
	_, err := GetUrlDelay(nil, "https://example.com", context.Background())
	if err == nil {
		t.Fatal("expected error when http client is nil")
	}
	if !strings.Contains(err.Error(), "http client is nil") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetURLDelayInvalidURL(t *testing.T) {
	_, err := GetUrlDelay(http.DefaultClient, "http://[::1", context.Background())
	if err == nil {
		t.Fatal("expected error for invalid url")
	}
}

func TestGetURLDelaySuccess(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.Method != http.MethodHead {
				t.Fatalf("expected HEAD method, got %s", req.Method)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("")),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	}

	delay, err := GetUrlDelay(client, "https://example.com/v1", nil)
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if delay < 0 {
		t.Fatalf("delay should not be negative, got %d", delay)
	}
}
