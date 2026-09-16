import { AndroidFile } from '../types';

export const ANDROID_FILES: AndroidFile[] = [
  {
    name: 'build.gradle (Module: app)',
    path: 'app/build.gradle',
    category: 'gradle',
    language: 'groovy',
    description: 'Configuração de dependências incluindo AndroidX Media3 (ExoPlayer), OkHttp, Glide, ViewModel e Material.',
    content: `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.iptv.player'
    compileSdk 34

    defaultConfig {
        applicationId "com.iptv.player"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        
        // Habilita suporte a decodificadores nativos e multidex para listas grandes
        multiDexEnabled true
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
        debug {
            minifyEnabled false
            applicationIdSuffix ".debug"
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    buildFeatures {
        viewBinding true
    }
}

dependencies {
    // AndroidX Core & UI
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.recyclerview:recyclerview:1.3.2'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
    implementation 'androidx.multidex:multidex:2.0.1'

    // AndroidX Media3 (ExoPlayer moderno para HLS / M3U8 / DASH / MP4)
    def media3_version = "1.3.0"
    implementation "androidx.media3:media3-exoplayer:$media3_version"
    implementation "androidx.media3:media3-exoplayer-hls:$media3_version"
    implementation "androidx.media3:media3-exoplayer-dash:$media3_version"
    implementation "androidx.media3:media3-ui:$media3_version"
    implementation "androidx.media3:media3-datasource-okhttp:$media3_version"

    // Arquitetura MVVM (Lifecycle & ViewModel para Java)
    def lifecycle_version = "2.7.0"
    implementation "androidx.lifecycle:lifecycle-viewmodel:$lifecycle_version"
    implementation "androidx.lifecycle:lifecycle-livedata:$lifecycle_version"
    implementation "androidx.lifecycle:lifecycle-common-java8:$lifecycle_version"

    // Networking e Streaming de Listas M3U (OkHttp3 com suporte a gzip e timeouts configuráveis)
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'

    // Carregamento e Caching de Logotipos dos Canais (Glide otimizado)
    implementation 'com.github.bumptech.glide:glide:4.16.0'
    annotationProcessor 'com.github.bumptech.glide:compiler:4.16.0'

    // Suporte a Android TV / TV Box (Leanback Opcional para navegação por D-Pad)
    implementation 'androidx.leanback:leanback:1.0.0'

    // Testes
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}`
  },
  {
    name: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    category: 'manifest',
    language: 'xml',
    description: 'Permissões de rede, suporte a HTTP/HTTPS livre para streams IPTV e configuração para TV Box e Celular.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.iptv.player">

    <!-- Permissões essenciais para Streaming IPTV -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <!-- Suporte para Android TV e TV Box (touchscreen não obrigatório) -->
    <uses-feature
        android:name="android.hardware.touchscreen"
        android:required="false" />
    <uses-feature
        android:name="android.software.leanback"
        android:required="false" />

    <application
        android:name=".IPTVApplication"
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.IPTVPlayer.Dark"
        android:usesCleartextTraffic="true"
        tools:targetApi="34">

        <!-- Tela Principal de Canais e Categorias -->
        <activity
            android:name=".presentation.ui.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:windowSoftInputMode="adjustPan">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <!-- Banner para Android TV / TV Box -->
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Tela do Player ExoPlayer Fullscreen -->
        <activity
            android:name=".presentation.ui.PlayerActivity"
            android:exported="false"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize"
            android:screenOrientation="sensorLandscape"
            android:supportsPictureInPicture="true"
            android:theme="@style/Theme.IPTVPlayer.PlayerFullscreen" />

    </application>

</manifest>`
  },
  {
    name: 'Channel.java',
    path: 'app/src/main/java/com/iptv/player/data/model/Channel.java',
    category: 'model',
    language: 'java',
    description: 'Entidade de dados do canal com suporte a Parcelable para transferência rápida entre Activities.',
    content: `package com.iptv.player.data.model;

import android.os.Parcel;
import android.os.Parcelable;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import java.util.Objects;

/**
 * Modelo de domínio que representa um canal de TV ou stream de mídia da lista M3U.
 * Implementa Parcelable para máxima velocidade de serialização no Android.
 */
public class Channel implements Parcelable {
    private final String id;
    private final String name;
    private final String streamUrl;
    private final String logoUrl;
    private final String groupTitle;
    private final String tvgId;
    private final String tvgName;
    private final String userAgent;
    private boolean isFavorite;

    public Channel(String id, String name, String streamUrl, @Nullable String logoUrl,
                   @Nullable String groupTitle, @Nullable String tvgId,
                   @Nullable String tvgName, @Nullable String userAgent) {
        this.id = id != null ? id : String.valueOf(System.currentTimeMillis());
        this.name = name != null ? name.trim() : "Canal Sem Nome";
        this.streamUrl = streamUrl != null ? streamUrl.trim() : "";
        this.logoUrl = logoUrl != null ? logoUrl.trim() : null;
        this.groupTitle = (groupTitle != null && !groupTitle.trim().isEmpty()) 
                ? groupTitle.trim() : "Outros";
        this.tvgId = tvgId;
        this.tvgName = tvgName;
        this.userAgent = userAgent;
        this.isFavorite = false;
    }

    protected Channel(Parcel in) {
        id = in.readString();
        name = in.readString();
        streamUrl = in.readString();
        logoUrl = in.readString();
        groupTitle = in.readString();
        tvgId = in.readString();
        tvgName = in.readString();
        userAgent = in.readString();
        isFavorite = in.readByte() != 0;
    }

    public static final Creator<Channel> CREATOR = new Creator<Channel>() {
        @Override
        public Channel createFromParcel(Parcel in) {
            return new Channel(in);
        }

        @Override
        public Channel[] newArray(int size) {
            return new Channel[size];
        }
    };

    public String getId() { return id; }
    public String getName() { return name; }
    public String getStreamUrl() { return streamUrl; }
    public String getLogoUrl() { return logoUrl; }
    public String getGroupTitle() { return groupTitle; }
    public String getTvgId() { return tvgId; }
    public String getTvgName() { return tvgName; }
    public String getUserAgent() { return userAgent; }
    public boolean isFavorite() { return isFavorite; }
    public void setFavorite(boolean favorite) { isFavorite = favorite; }

    @Override
    public int describeContents() { return 0; }

    @Override
    public void writeToParcel(@NonNull Parcel dest, int flags) {
        dest.writeString(id);
        dest.writeString(name);
        dest.writeString(streamUrl);
        dest.writeString(logoUrl);
        dest.writeString(groupTitle);
        dest.writeString(tvgId);
        dest.writeString(tvgName);
        dest.writeString(userAgent);
        dest.writeByte((byte) (isFavorite ? 1 : 0));
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Channel channel = (Channel) o;
        return Objects.equals(id, channel.id) &&
               Objects.equals(streamUrl, channel.streamUrl);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, streamUrl);
    }
}`
  },
  {
    name: 'M3UParser.java',
    path: 'app/src/main/java/com/iptv/player/data/parser/M3UParser.java',
    category: 'parser',
    language: 'java',
    description: 'Leitor M3U/M3U8 de alta performance baseado em BufferedReader e Regex com streaming sem estouro de memória.',
    content: `package com.iptv.player.data.parser;

import com.iptv.player.data.model.Channel;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser de alta performance para listas M3U e M3U8.
 * Utiliza leitura linear por fluxo (Stream) com buffer para processar listas com mais
 * de 100.000 canais sem causar OutOfMemoryError (OOM) na JVM do Android.
 */
public class M3UParser {

    // Regex pré-compilados para máxima velocidade em loops intensos
    private static final Pattern PATTERN_TVG_ID = Pattern.compile("tvg-id=\\"([^\\"]*)\\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern PATTERN_TVG_NAME = Pattern.compile("tvg-name=\\"([^\\"]*)\\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern PATTERN_TVG_LOGO = Pattern.compile("tvg-logo=\\"([^\\"]*)\\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern PATTERN_GROUP_TITLE = Pattern.compile("group-title=\\"([^\\"]*)\\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern PATTERN_USER_AGENT = Pattern.compile("http-user-agent=\\"([^\\"]*)\\"", Pattern.CASE_INSENSITIVE);

    public interface OnParseProgressListener {
        void onProgress(int channelsParsed);
    }

    /**
     * Faz o parse de um InputStream (seja de arquivo local ou requisição OkHttp).
     *
     * @param inputStream Fluxo de bytes da lista M3U.
     * @param listener    Listener opcional para reportar progresso em tempo real.
     * @return Lista de canais formatados e limpos.
     * @throws IOException Se houver falha de leitura.
     */
    public List<Channel> parse(InputStream inputStream, OnParseProgressListener listener) throws IOException {
        List<Channel> channels = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8), 32 * 1024);

        String line;
        String currentExtInf = null;
        String currentUserAgent = null;
        int channelIndex = 1;

        while ((line = reader.readLine()) != null) {
            line = line.trim();

            if (line.isEmpty()) {
                continue;
            }

            if (line.startsWith("#EXTINF:")) {
                currentExtInf = line;
            } else if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
                currentUserAgent = line.substring("#EXTVLCOPT:http-user-agent=".length()).trim();
            } else if (!line.startsWith("#")) {
                // Se não começa com #, trata-se da URL do Stream (m3u8, mp4, ts, etc.)
                if (currentExtInf != null) {
                    Channel channel = extractChannel(currentExtInf, line, channelIndex++, currentUserAgent);
                    if (channel != null) {
                        channels.add(channel);
                        if (listener != null && channelIndex % 500 == 0) {
                            listener.onProgress(channels.size());
                        }
                    }
                    currentExtInf = null;
                    currentUserAgent = null;
                } else if (line.startsWith("http://") || line.startsWith("https://") || line.startsWith("rtmp://")) {
                    // Caso a lista seja simplificada (apenas links sem EXTINF)
                    String autoName = "Canal " + channelIndex;
                    channels.add(new Channel(String.valueOf(channelIndex), autoName, line, null, "Geral", null, null, null));
                    channelIndex++;
                }
            }
        }

        reader.close();
        return channels;
    }

    private Channel extractChannel(String extInfLine, String streamUrl, int index, String customUserAgent) {
        if (streamUrl == null || streamUrl.trim().isEmpty()) {
            return null;
        }

        String tvgId = extractAttribute(PATTERN_TVG_ID, extInfLine);
        String tvgName = extractAttribute(PATTERN_TVG_NAME, extInfLine);
        String tvgLogo = extractAttribute(PATTERN_TVG_LOGO, extInfLine);
        String groupTitle = extractAttribute(PATTERN_GROUP_TITLE, extInfLine);
        String userAgent = extractAttribute(PATTERN_USER_AGENT, extInfLine);

        if (userAgent == null && customUserAgent != null) {
            userAgent = customUserAgent;
        }

        // O nome do canal geralmente vem após a última vírgula na linha #EXTINF
        String channelName = null;
        int commaIndex = extInfLine.lastIndexOf(',');
        if (commaIndex != -1 && commaIndex < extInfLine.length() - 1) {
            channelName = extInfLine.substring(commaIndex + 1).trim();
        }

        if (channelName == null || channelName.isEmpty()) {
            channelName = tvgName != null ? tvgName : ("Canal " + index);
        }

        String id = (tvgId != null && !tvgId.isEmpty()) ? tvgId : String.valueOf(index);

        return new Channel(id, channelName, streamUrl, tvgLogo, groupTitle, tvgId, tvgName, userAgent);
    }

    private String extractAttribute(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }
}`
  },
  {
    name: 'PlaylistRepository.java',
    path: 'app/src/main/java/com/iptv/player/data/repository/PlaylistRepository.java',
    category: 'repository',
    language: 'java',
    description: 'Repositório de dados com OkHttp para download em thread de fundo e leitura de arquivos locais.',
    content: `package com.iptv.player.data.repository;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.iptv.player.data.model.Channel;
import com.iptv.player.data.parser.M3UParser;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * Repositório responsável por buscar e intermediar listas M3U/M3U8
 * via HTTP/HTTPS ou do sistema de arquivos local do Android.
 */
public class PlaylistRepository {

    private final OkHttpClient httpClient;
    private final M3UParser m3uParser;
    private final ExecutorService executorService;
    private final Handler mainHandler;

    public interface PlaylistCallback {
        void onSuccess(List<Channel> channels);
        void onProgress(int loadedCount);
        void onError(Exception error);
    }

    public PlaylistRepository() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .followRedirects(true)
                .followSslRedirects(true)
                .build();
        this.m3uParser = new M3UParser();
        this.executorService = Executors.newFixedThreadPool(2);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    /**
     * Carrega uma lista M3U a partir de uma URL remota.
     */
    public void loadFromUrl(String url, PlaylistCallback callback) {
        executorService.execute(() -> {
            try {
                Request request = new Request.Builder()
                        .url(url)
                        .header("User-Agent", "Mozilla/5.0 (Android; IPTV Player; ExoPlayer)")
                        .build();

                try (Response response = httpClient.newCall(request).execute()) {
                    if (!response.isSuccessful()) {
                        throw new Exception("Erro HTTP " + response.code() + ": " + response.message());
                    }

                    ResponseBody body = response.body();
                    if (body == null) {
                        throw new Exception("Resposta da lista M3U veio vazia.");
                    }

                    InputStream inputStream = body.byteStream();
                    List<Channel> channels = m3uParser.parse(inputStream, count -> {
                        mainHandler.post(() -> callback.onProgress(count));
                    });

                    mainHandler.post(() -> callback.onSuccess(channels));
                }
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }

    /**
     * Carrega uma lista M3U a partir de um Uri local (armazenamento do aparelho).
     */
    public void loadFromUri(Context context, Uri fileUri, PlaylistCallback callback) {
        executorService.execute(() -> {
            try {
                InputStream inputStream = context.getContentResolver().openInputStream(fileUri);
                if (inputStream == null) {
                    throw new Exception("Não foi possível abrir o arquivo local selecionado.");
                }

                List<Channel> channels = m3uParser.parse(inputStream, count -> {
                    mainHandler.post(() -> callback.onProgress(count));
                });

                mainHandler.post(() -> callback.onSuccess(channels));
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError(e));
            }
        });
    }
}`
  },
  {
    name: 'MainViewModel.java',
    path: 'app/src/main/java/com/iptv/player/presentation/viewmodel/MainViewModel.java',
    category: 'viewmodel',
    language: 'java',
    description: 'ViewModel que gerencia o estado da UI, filtragem por categorias, busca rápida e lista de favoritos.',
    content: `package com.iptv.player.presentation.viewmodel;

import android.app.Application;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import com.iptv.player.data.model.Channel;
import com.iptv.player.data.repository.PlaylistRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * ViewModel que desacopla a regra de negócio e os dados da interface gráfica.
 * Mantém o estado dos canais durante mudanças de orientação de tela do Android.
 */
public class MainViewModel extends AndroidViewModel {

    private final PlaylistRepository repository;
    private final List<Channel> fullChannelList = new ArrayList<>();

    private final MutableLiveData<List<Channel>> displayedChannels = new MutableLiveData<>();
    private final MutableLiveData<List<String>> categories = new MutableLiveData<>();
    private final MutableLiveData<Boolean> isLoading = new MutableLiveData<>(false);
    private final MutableLiveData<String> errorMessage = new MutableLiveData<>();
    private final MutableLiveData<Integer> loadProgress = new MutableLiveData<>(0);

    private String selectedCategory = "TODOS";
    private String currentSearchQuery = "";

    public MainViewModel(@NonNull Application application) {
        super(application);
        this.repository = new PlaylistRepository();
    }

    public LiveData<List<Channel>> getDisplayedChannels() { return displayedChannels; }
    public LiveData<List<String>> getCategories() { return categories; }
    public LiveData<Boolean> getIsLoading() { return isLoading; }
    public LiveData<String> getErrorMessage() { return errorMessage; }
    public LiveData<Integer> getLoadProgress() { return loadProgress; }

    public void loadPlaylistFromUrl(String url) {
        isLoading.setValue(true);
        loadProgress.setValue(0);
        errorMessage.setValue(null);

        repository.loadFromUrl(url, new PlaylistRepository.PlaylistCallback() {
            @Override
            public void onSuccess(List<Channel> channels) {
                processLoadedChannels(channels);
            }

            @Override
            public void onProgress(int loadedCount) {
                loadProgress.setValue(loadedCount);
            }

            @Override
            public void onError(Exception error) {
                isLoading.setValue(false);
                errorMessage.setValue(error.getMessage());
            }
        });
    }

    public void loadPlaylistFromUri(Uri fileUri) {
        isLoading.setValue(true);
        loadProgress.setValue(0);
        errorMessage.setValue(null);

        repository.loadFromUri(getApplication(), fileUri, new PlaylistRepository.PlaylistCallback() {
            @Override
            public void onSuccess(List<Channel> channels) {
                processLoadedChannels(channels);
            }

            @Override
            public void onProgress(int loadedCount) {
                loadProgress.setValue(loadedCount);
            }

            @Override
            public void onError(Exception error) {
                isLoading.setValue(false);
                errorMessage.setValue(error.getMessage());
            }
        });
    }

    private void processLoadedChannels(List<Channel> channels) {
        fullChannelList.clear();
        fullChannelList.addAll(channels);

        // Extrai categorias únicas
        Set<String> uniqueGroups = new HashSet<>();
        for (Channel c : channels) {
            uniqueGroups.add(c.getGroupTitle());
        }

        List<String> sortedCategories = new ArrayList<>(uniqueGroups);
        Collections.sort(sortedCategories);
        sortedCategories.add(0, "TODOS");
        sortedCategories.add(1, "FAVORITOS");

        categories.setValue(sortedCategories);
        selectedCategory = "TODOS";
        currentSearchQuery = "";

        applyFilters();
        isLoading.setValue(false);
    }

    public void selectCategory(String category) {
        this.selectedCategory = category;
        applyFilters();
    }

    public void filterBySearch(String query) {
        this.currentSearchQuery = query != null ? query.trim().toLowerCase() : "";
        applyFilters();
    }

    public void toggleFavorite(Channel channel) {
        channel.setFavorite(!channel.isFavorite());
        applyFilters();
    }

    private void applyFilters() {
        List<Channel> filtered = new ArrayList<>();
        boolean isAll = "TODOS".equalsIgnoreCase(selectedCategory);
        boolean isFav = "FAVORITOS".equalsIgnoreCase(selectedCategory);

        for (Channel c : fullChannelList) {
            boolean matchesCategory = isAll || (isFav && c.isFavorite()) || c.getGroupTitle().equalsIgnoreCase(selectedCategory);
            boolean matchesSearch = currentSearchQuery.isEmpty() || c.getName().toLowerCase().contains(currentSearchQuery);

            if (matchesCategory && matchesSearch) {
                filtered.add(c);
            }
        }

        displayedChannels.setValue(filtered);
    }
}`
  },
  {
    name: 'ChannelAdapter.java',
    path: 'app/src/main/java/com/iptv/player/presentation/adapter/ChannelAdapter.java',
    category: 'adapter',
    language: 'java',
    description: 'Adapter otimizado com DiffUtil, ViewHolder de alta performance, Glide com cache em disco e foco para TV Box.',
    content: `package com.iptv.player.presentation.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ListAdapter;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.iptv.player.R;
import com.iptv.player.data.model.Channel;

/**
 * Adapter otimizado com ListAdapter e DiffUtil para garantir 60fps constantes
 * mesmo ao rolar listas com centenas ou milhares de canais no Android TV e Celular.
 */
public class ChannelAdapter extends ListAdapter<Channel, ChannelAdapter.ChannelViewHolder> {

    public interface OnChannelClickListener {
        void onChannelClick(Channel channel, int position);
        void onChannelFavoriteToggle(Channel channel, int position);
    }

    private final OnChannelClickListener listener;

    public ChannelAdapter(OnChannelClickListener listener) {
        super(DIFF_CALLBACK);
        this.listener = listener;
        setHasStableIds(true); // Otimização para evitar redesenhos desnecessários
    }

    private static final DiffUtil.ItemCallback<Channel> DIFF_CALLBACK = new DiffUtil.ItemCallback<Channel>() {
        @Override
        public boolean areItemsTheSame(@NonNull Channel oldItem, @NonNull Channel newItem) {
            return oldItem.getId().equals(newItem.getId());
        }

        @Override
        public boolean areContentsTheSame(@NonNull Channel oldItem, @NonNull Channel newItem) {
            return oldItem.getName().equals(newItem.getName()) &&
                   oldItem.isFavorite() == newItem.isFavorite() &&
                   String.valueOf(oldItem.getLogoUrl()).equals(String.valueOf(newItem.getLogoUrl()));
        }
    };

    @Override
    public long getItemId(int position) {
        return getItem(position).getId().hashCode();
    }

    @NonNull
    @Override
    public ChannelViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_channel, parent, false);
        return new ChannelViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ChannelViewHolder holder, int position) {
        holder.bind(getItem(position), listener);
    }

    public static class ChannelViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvName;
        private final TextView tvCategory;
        private final ImageView ivLogo;
        private final ImageView ivFavorite;

        public ChannelViewHolder(@NonNull View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tvChannelName);
            tvCategory = itemView.findViewById(R.id.tvChannelCategory);
            ivLogo = itemView.findViewById(R.id.ivChannelLogo);
            ivFavorite = itemView.findViewById(R.id.ivFavorite);

            // Suporte essencial a controle remoto (D-Pad) de TV Box / Android TV
            itemView.setFocusable(true);
            itemView.setFocusableInTouchMode(true);
        }

        public void bind(Channel channel, OnChannelClickListener listener) {
            tvName.setText(channel.getName());
            tvCategory.setText(channel.getGroupTitle());

            // Carregamento assíncrono com Glide otimizado para memória e cache
            if (channel.getLogoUrl() != null && !channel.getLogoUrl().isEmpty()) {
                Glide.with(itemView.getContext())
                        .load(channel.getLogoUrl())
                        .diskCacheStrategy(DiskCacheStrategy.ALL)
                        .placeholder(R.drawable.ic_channel_placeholder)
                        .error(R.drawable.ic_channel_placeholder)
                        .centerInside()
                        .into(ivLogo);
            } else {
                ivLogo.setImageResource(R.drawable.ic_channel_placeholder);
            }

            ivFavorite.setImageResource(channel.isFavorite() 
                    ? R.drawable.ic_favorite_filled 
                    : R.drawable.ic_favorite_border);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onChannelClick(channel, getAdapterPosition());
                }
            });

            ivFavorite.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onChannelFavoriteToggle(channel, getAdapterPosition());
                }
            });
        }
    }
}`
  },
  {
    name: 'PlayerActivity.java',
    path: 'app/src/main/java/com/iptv/player/presentation/ui/PlayerActivity.java',
    category: 'ui',
    language: 'java',
    description: 'Player de vídeo completo com AndroidX Media3 (ExoPlayer), buffer inteligente, controle D-Pad e proporção de tela.',
    content: `package com.iptv.player.presentation.ui;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import com.iptv.player.R;
import com.iptv.player.data.model.Channel;

/**
 * Activity responsável pela reprodução nativa de streams IPTV utilizando o AndroidX Media3 ExoPlayer.
 * Oferece suporte completo a fluxos ao vivo (Live HLS/M3U8), reconexão inteligente,
 * alternância de aspect ratio (16:9, Zoom, Fill) e comandos de controle remoto (D-Pad TV Box).
 */
@UnstableApi
public class PlayerActivity extends AppCompatActivity {

    public static final String EXTRA_CHANNEL = "extra_channel";

    private PlayerView playerView;
    private ExoPlayer player;
    private ProgressBar progressBar;
    private TextView tvPlayerTitle;
    private Channel currentChannel;

    private int currentResizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Tela cheia imersiva e manter tela sempre acesa (WakeLock via Flag)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUI();

        setContentView(R.layout.activity_player);

        currentChannel = getIntent().getParcelableExtra(EXTRA_CHANNEL);
        if (currentChannel == null) {
            Toast.makeText(this, "Canal inválido.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initViews();
        setupExoPlayer();
    }

    private void initViews() {
        playerView = findViewById(R.id.playerView);
        progressBar = findViewById(R.id.playerProgressBar);
        tvPlayerTitle = findViewById(R.id.tvPlayerTitle);

        tvPlayerTitle.setText(currentChannel.getName());

        // Botão para alternar proporção de tela (Fit, Zoom, Fill)
        View btnAspectRatio = findViewById(R.id.btnAspectRatio);
        if (btnAspectRatio != null) {
            btnAspectRatio.setOnClickListener(v -> cycleAspectRatio());
        }

        // Botão Fechar / Voltar
        View btnBack = findViewById(R.id.btnPlayerBack);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> finish());
        }
    }

    private void setupExoPlayer() {
        // LoadControl afinado para IPTV (Buffer menor para arranque instantâneo de canais ao vivo)
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        1000,  // minBufferMs (arranque rápido)
                        5000,  // maxBufferMs
                        500,   // bufferForPlaybackMs
                        1000   // bufferForPlaybackAfterRebufferMs
                )
                .build();

        // Configura fonte de dados HTTP com User-Agent personalizado do canal ou genérico
        String userAgent = currentChannel.getUserAgent() != null 
                ? currentChannel.getUserAgent() 
                : "IPTVSmarters/1.0 (Android; ExoPlayer Media3)";

        DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent(userAgent)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000);

        player = new ExoPlayer.Builder(this)
                .setLoadControl(loadControl)
                .build();

        playerView.setPlayer(player);
        playerView.setResizeMode(currentResizeMode);
        playerView.setControllerShowTimeoutMs(3500);

        // Listener de eventos do player (Buffer, Erro de codec, Conexão encerrada)
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_BUFFERING) {
                    progressBar.setVisibility(View.VISIBLE);
                } else if (playbackState == Player.STATE_READY) {
                    progressBar.setVisibility(View.GONE);
                } else if (playbackState == Player.STATE_ENDED) {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(PlayerActivity.this, "Erro ao reproduzir stream: " + error.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

        startStream(currentChannel.getStreamUrl(), httpDataSourceFactory);
    }

    private void startStream(String streamUrl, DefaultHttpDataSource.Factory dataSourceFactory) {
        Uri uri = Uri.parse(streamUrl);
        MediaSource mediaSource;

        // Identifica se é fluxo HLS (.m3u8) ou arquivo direto (.mp4, .ts, .mkv)
        if (streamUrl.contains(".m3u8") || streamUrl.contains("hls")) {
            mediaSource = new HlsMediaSource.Factory(dataSourceFactory)
                    .setAllowChunklessPreparation(true)
                    .createMediaSource(MediaItem.fromUri(uri));
        } else {
            mediaSource = new ProgressiveMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri));
        }

        player.setMediaSource(mediaSource);
        player.prepare();
        player.setPlayWhenReady(true);
    }

    private void cycleAspectRatio() {
        if (currentResizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) {
            currentResizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL;
            Toast.makeText(this, "Modo: Preencher Tela (Fill)", Toast.LENGTH_SHORT).show();
        } else if (currentResizeMode == AspectRatioFrameLayout.RESIZE_MODE_FILL) {
            currentResizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM;
            Toast.makeText(this, "Modo: Zoom", Toast.LENGTH_SHORT).show();
        } else {
            currentResizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT;
            Toast.makeText(this, "Modo: Original (Fit)", Toast.LENGTH_SHORT).show();
        }
        playerView.setResizeMode(currentResizeMode);
    }

    /**
     * Suporte para atalhos de controle remoto de TV Box / Android TV
     */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                if (player != null) {
                    if (player.isPlaying()) {
                        player.pause();
                    } else {
                        player.play();
                    }
                }
                playerView.showController();
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                if (player != null) {
                    if (player.isPlaying()) player.pause(); else player.play();
                }
                return true;
            case KeyEvent.KEYCODE_BACK:
                finish();
                return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            player.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}`
  },
  {
    name: 'MainActivity.java',
    path: 'app/src/main/java/com/iptv/player/presentation/ui/MainActivity.java',
    category: 'ui',
    language: 'java',
    description: 'Activity principal com suporte a busca em tempo real, abas de categorias e carregamento de listas.',
    content: `package com.iptv.player.presentation.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.iptv.player.R;
import com.iptv.player.data.model.Channel;
import com.iptv.player.presentation.adapter.ChannelAdapter;
import com.iptv.player.presentation.adapter.GroupAdapter;
import com.iptv.player.presentation.viewmodel.MainViewModel;

/**
 * Tela principal do IPTV Player.
 * Segue o padrão MVVM conectando o RecyclerView ao MainViewModel com LiveData.
 */
public class MainActivity extends AppCompatActivity implements ChannelAdapter.OnChannelClickListener {

    private MainViewModel viewModel;
    private ChannelAdapter channelAdapter;
    private GroupAdapter groupAdapter;

    private RecyclerView rvChannels;
    private RecyclerView rvCategories;
    private ProgressBar progressBar;
    private TextView tvStatus;
    private EditText etSearch;

    // Seletor de arquivo local .m3u/.m3u8
    private final ActivityResultLauncher<String[]> filePickerLauncher =
            registerForActivityResult(new ActivityResultContracts.OpenDocument(), uri -> {
                if (uri != null) {
                    viewModel.loadPlaylistFromUri(uri);
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        viewModel = new ViewModelProvider(this).get(MainViewModel.class);

        initViews();
        setupRecyclerViews();
        observeViewModel();

        // Carrega uma lista padrão ou solicita inserção
        showPlaylistChooserDialog();
    }

    private void initViews() {
        rvChannels = findViewById(R.id.rvChannels);
        rvCategories = findViewById(R.id.rvCategories);
        progressBar = findViewById(R.id.mainProgressBar);
        tvStatus = findViewById(R.id.tvStatus);
        etSearch = findViewById(R.id.etSearch);

        findViewById(R.id.btnLoadPlaylist).setOnClickListener(v -> showPlaylistChooserDialog());

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                viewModel.filterBySearch(s.toString());
            }
            @Override public void afterTextChanged(Editable s) {}
        });
    }

    private void setupRecyclerViews() {
        // Grid responsivo: 3 a 5 colunas dependendo se é celular ou TV Box grande
        int spanCount = getResources().getInteger(R.integer.channel_grid_span_count);
        rvChannels.setLayoutManager(new GridLayoutManager(this, spanCount));
        channelAdapter = new ChannelAdapter(this);
        rvChannels.setAdapter(channelAdapter);

        // Lista horizontal de categorias
        rvCategories.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        groupAdapter = new GroupAdapter(category -> viewModel.selectCategory(category));
        rvCategories.setAdapter(groupAdapter);
    }

    private void observeViewModel() {
        viewModel.getDisplayedChannels().observe(this, channels -> {
            channelAdapter.submitList(channels);
            tvStatus.setText(channels != null ? channels.size() + " canais disponíveis" : "Nenhum canal");
        });

        viewModel.getCategories().observe(this, categories -> {
            groupAdapter.setCategories(categories);
        });

        viewModel.getIsLoading().observe(this, loading -> {
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        });

        viewModel.getLoadProgress().observe(this, count -> {
            if (count > 0) {
                tvStatus.setText("Carregando: " + count + " canais processados...");
            }
        });

        viewModel.getErrorMessage().observe(this, error -> {
            if (error != null) {
                Toast.makeText(this, "Erro: " + error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showPlaylistChooserDialog() {
        String[] options = {"Carregar por URL (Web)", "Escolher Arquivo Local (.m3u / .m3u8)"};
        new MaterialAlertDialogBuilder(this)
                .setTitle("Importar Lista IPTV")
                .setItems(options, (dialog, which) -> {
                    if (which == 0) {
                        showUrlInputDialog();
                    } else {
                        filePickerLauncher.launch(new String[]{"*/*"});
                    }
                })
                .setPositiveButton("Cancelar", null)
                .show();
    }

    private void showUrlInputDialog() {
        final EditText input = new EditText(this);
        input.setHint("https://exemplo.com/lista.m3u8");

        new MaterialAlertDialogBuilder(this)
                .setTitle("Inserir URL da Lista M3U")
                .setView(input)
                .setPositiveButton("Carregar", (dialog, which) -> {
                    String url = input.getText().toString().trim();
                    if (!url.isEmpty()) {
                        viewModel.loadPlaylistFromUrl(url);
                    }
                })
                .setNegativeButton("Voltar", null)
                .show();
    }

    @Override
    public void onChannelClick(Channel channel, int position) {
        Intent intent = new Intent(this, PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_CHANNEL, channel);
        startActivity(intent);
    }

    @Override
    public void onChannelFavoriteToggle(Channel channel, int position) {
        viewModel.toggleFavorite(channel);
    }
}`
  },
  {
    name: 'GroupAdapter.java',
    path: 'app/src/main/java/com/iptv/player/presentation/adapter/GroupAdapter.java',
    category: 'adapter',
    language: 'java',
    description: 'Adapter horizontal para a barra de filtros de categorias/grupos.',
    content: `package com.iptv.player.presentation.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.iptv.player.R;
import java.util.ArrayList;
import java.util.List;

public class GroupAdapter extends RecyclerView.Adapter<GroupAdapter.GroupViewHolder> {

    public interface OnGroupClickListener {
        void onGroupClick(String groupName);
    }

    private final List<String> categories = new ArrayList<>();
    private final OnGroupClickListener listener;
    private int selectedPosition = 0;

    public GroupAdapter(OnGroupClickListener listener) {
        this.listener = listener;
    }

    public void setCategories(List<String> newCategories) {
        this.categories.clear();
        if (newCategories != null) {
            this.categories.addAll(newCategories);
        }
        this.selectedPosition = 0;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public GroupViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_group, parent, false);
        return new GroupViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull GroupViewHolder holder, int position) {
        String category = categories.get(position);
        boolean isSelected = position == selectedPosition;
        holder.bind(category, isSelected, v -> {
            int prev = selectedPosition;
            selectedPosition = holder.getAdapterPosition();
            notifyItemChanged(prev);
            notifyItemChanged(selectedPosition);
            if (listener != null) {
                listener.onGroupClick(category);
            }
        });
    }

    @Override
    public int getItemCount() {
        return categories.size();
    }

    public static class GroupViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvGroupTitle;

        public GroupViewHolder(@NonNull View itemView) {
            super(itemView);
            tvGroupTitle = itemView.findViewById(R.id.tvGroupTitle);
            itemView.setFocusable(true);
        }

        public void bind(String name, boolean isSelected, View.OnClickListener clickListener) {
            tvGroupTitle.setText(name);
            itemView.setSelected(isSelected);
            itemView.setOnClickListener(clickListener);
        }
    }
}`
  },
  {
    name: 'item_channel.xml',
    path: 'app/src/main/res/layout/item_channel.xml',
    category: 'layout',
    language: 'xml',
    description: 'Layout em CardView com suporte a foco D-Pad para TV Box, logotipo, nome e botão de favorito.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<com.google.android.material.card.MaterialCardView 
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_margin="6dp"
    android:clickable="true"
    android:focusable="true"
    android:foreground="?attr/selectableItemBackground"
    app:cardBackgroundColor="#1A1F29"
    app:cardCornerRadius="12dp"
    app:cardElevation="2dp"
    app:strokeColor="@drawable/selector_focus_stroke"
    app:strokeWidth="2dp">

    <androidx.constraintlayout.widget.ConstraintLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:padding="10dp">

        <ImageView
            android:id="@+id/ivChannelLogo"
            android:layout_width="60dp"
            android:layout_height="60dp"
            android:contentDescription="@string/channel_logo_desc"
            android:scaleType="fitCenter"
            app:layout_constraintEnd_toEndOf="parent"
            app:layout_constraintStart_toStartOf="parent"
            app:layout_constraintTop_toTopOf="parent"
            tools:src="@drawable/ic_channel_placeholder" />

        <ImageView
            android:id="@+id/ivFavorite"
            android:layout_width="24dp"
            android:layout_height="24dp"
            android:padding="2dp"
            android:contentDescription="@string/toggle_favorite"
            app:layout_constraintEnd_toEndOf="parent"
            app:layout_constraintTop_toTopOf="parent"
            app:srcCompat="@drawable/ic_favorite_border"
            app:tint="#F59E0B" />

        <TextView
            android:id="@+id/tvChannelName"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:ellipsize="end"
            android:gravity="center"
            android:maxLines="2"
            android:textColor="#FFFFFF"
            android:textSize="14sp"
            android:textStyle="bold"
            app:layout_constraintEnd_toEndOf="parent"
            app:layout_constraintStart_toStartOf="parent"
            app:layout_constraintTop_toBottomOf="@id/ivChannelLogo"
            tools:text="ESPN Brasil HD" />

        <TextView
            android:id="@+id/tvChannelCategory"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:ellipsize="end"
            android:gravity="center"
            android:maxLines="1"
            android:textColor="#94A3B8"
            android:textSize="11sp"
            app:layout_constraintEnd_toEndOf="parent"
            app:layout_constraintStart_toStartOf="parent"
            app:layout_constraintTop_toBottomOf="@id/tvChannelName"
            tools:text="Esportes" />

    </androidx.constraintlayout.widget.ConstraintLayout>

</com.google.android.material.card.MaterialCardView>`
  },
  {
    name: 'activity_player.xml',
    path: 'app/src/main/res/layout/activity_player.xml',
    category: 'layout',
    language: 'xml',
    description: 'Interface do Player Fullscreen com ExoPlayer PlayerView, overlay de controles e indicador de buffer.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout 
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#000000">

    <!-- PlayerView nativo do AndroidX Media3 -->
    <androidx.media3.ui.PlayerView
        android:id="@+id/playerView"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        app:controller_layout_id="@layout/custom_player_controls"
        app:show_buffering="when_playing"
        app:use_controller="true" />

    <!-- Barra de Progresso Customizada para Buffering -->
    <ProgressBar
        android:id="@+id/playerProgressBar"
        style="?android:attr/progressBarStyleLarge"
        android:layout_width="64dp"
        android:layout_height="64dp"
        android:indeterminate="true"
        android:indeterminateTint="#3B82F6"
        android:visibility="gone"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

    <!-- Título do Canal Superior -->
    <LinearLayout
        android:id="@+id/topBarOverlay"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="#80000000"
        android:gravity="center_vertical"
        android:orientation="horizontal"
        android:padding="16dp"
        app:layout_constraintTop_toTopOf="parent">

        <ImageButton
            android:id="@+id/btnPlayerBack"
            android:layout_width="40dp"
            android:layout_height="40dp"
            android:background="?attr/selectableItemBackgroundBorderless"
            android:src="@drawable/ic_arrow_back"
            app:tint="#FFFFFF"
            android:contentDescription="@string/back" />

        <TextView
            android:id="@+id/tvPlayerTitle"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_marginStart="16dp"
            android:layout_weight="1"
            android:ellipsize="end"
            android:maxLines="1"
            android:textColor="#FFFFFF"
            android:textSize="18sp"
            android:textStyle="bold"
            tools:text="Nome do Canal Ao Vivo" />

        <Button
            android:id="@+id/btnAspectRatio"
            style="@style/Widget.MaterialComponents.Button.TextButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="16:9"
            android:textColor="#3B82F6" />

    </LinearLayout>

</androidx.constraintlayout.widget.ConstraintLayout>`
  },
  {
    name: 'selector_focus_stroke.xml',
    path: 'app/src/main/res/drawable/selector_focus_stroke.xml',
    category: 'drawable',
    language: 'xml',
    description: 'Seletor de cor de borda para destacar itens focados pelo controle remoto no Android TV.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Quando focado pelo D-Pad do controle da TV Box -->
    <item android:color="#3B82F6" android:state_focused="true" />
    <item android:color="#2563EB" android:state_selected="true" />
    <!-- Estado padrão em repouso -->
    <item android:color="#2A3342" />
</selector>`
  }
];
